"""
PST Parser using win32com (Outlook COM interface)
This reads PST files using the locally installed Microsoft Outlook.
No data is uploaded to Microsoft - it's all local processing.
"""
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional, List
from ..core.db import get_db
from ..core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import win32com for Windows Outlook integration
try:
    import win32com.client
    import pythoncom
    WIN32COM_AVAILABLE = True
except ImportError:
    win32com = None
    pythoncom = None
    WIN32COM_AVAILABLE = False

# Also keep pypff as fallback for Linux/WSL
try:
    import pypff
    PYPFF_AVAILABLE = True
except ImportError:
    pypff = None
    PYPFF_AVAILABLE = False


def get_message_body_outlook(mail_item) -> Tuple[Optional[str], Optional[str]]:
    """Extract body text and HTML from Outlook mail item."""
    body_text = None
    body_html = None

    try:
        raw_body = mail_item.Body
        if raw_body:
            body_text = str(raw_body).encode('utf-8', errors='replace').decode('utf-8')
    except:
        pass

    try:
        raw_html = mail_item.HTMLBody
        if raw_html:
            body_html = str(raw_html).encode('utf-8', errors='replace').decode('utf-8')
    except:
        pass

    return body_text, body_html


def extract_snippet(body_text: Optional[str], body_html: Optional[str], max_len: int = 200) -> str:
    """Extract a preview snippet from the message body."""
    text = body_text or ""
    if not text and body_html:
        # Simple HTML stripping
        import re
        text = re.sub(r'<[^>]+>', '', body_html)
    
    snippet = text[:max_len].replace('\n', ' ').replace('\r', ' ').strip()
    if len(text) > max_len:
        snippet += "..."
    return snippet


def save_attachment_outlook(attachment, message_id: int, pst_id: str) -> Optional[dict]:
    """Save an attachment from Outlook mail item."""
    try:
        filename = attachment.FileName or "unnamed_attachment"
        
        # Get size if available
        try:
            size_bytes = attachment.Size
        except:
            size_bytes = 0
        
        if size_bytes and size_bytes > settings.MAX_ATTACHMENT_MB * 1024 * 1024:
            logger.warning(f"Attachment {filename} exceeds size limit, skipping physical storage")
            return {
                'filename': filename,
                'size_bytes': size_bytes,
                'mime_type': None,
                'stored_path': None
            }

        attachment_dir = Path(settings.STORAGE_DIR).resolve() / "attachments" / pst_id / str(message_id)
        attachment_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = filename
        counter = 1
        while (attachment_dir / safe_filename).exists():
            name_parts = filename.rsplit('.', 1)
            if len(name_parts) == 2:
                safe_filename = f"{name_parts[0]}_{counter}.{name_parts[1]}"
            else:
                safe_filename = f"{filename}_{counter}"
            counter += 1

        file_path = attachment_dir / safe_filename
        
        try:
            attachment.SaveAsFile(str(file_path))
        except Exception as e:
            logger.error(f"Error saving attachment file: {e}")
            return {
                'filename': filename,
                'size_bytes': size_bytes,
                'mime_type': None,
                'stored_path': None
            }

        # Infer MIME type from extension
        mime_type = None
        ext = safe_filename.split('.')[-1].lower() if '.' in safe_filename else None
        mime_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'txt': 'text/plain',
            'zip': 'application/zip',
        }
        mime_type = mime_map.get(ext)

        return {
            'filename': safe_filename,
            'size_bytes': size_bytes,
            'mime_type': mime_type,
            'stored_path': str(file_path)
        }

    except Exception as e:
        logger.error(f"Error saving attachment: {e}")
        return None


def process_folder_outlook(folder, pst_id: str, parent_id: Optional[int], path_parts: list, conn) -> int:
    """Process an Outlook folder and its subfolders."""
    cursor = conn.cursor()

    try:
        folder_name = folder.Name or "Unnamed"
    except:
        folder_name = "Unnamed"
    
    current_path = path_parts + [folder_name]
    path_display = "/".join(current_path)

    cursor.execute(
        """INSERT OR IGNORE INTO folders (pst_id, name, parent_id, path_display)
           VALUES (?, ?, ?, ?)""",
        (pst_id, folder_name, parent_id, path_display)
    )

    cursor.execute(
        "SELECT id FROM folders WHERE pst_id = ? AND path_display = ?",
        (pst_id, path_display)
    )
    result = cursor.fetchone()
    if not result:
        return 0
    folder_id = result['id']

    # Process messages in this folder
    try:
        items = folder.Items
        items_count = items.Count
        logger.info(f"Processing folder '{path_display}' with {items_count} items")
        
        batch_count = 0
        for i in range(1, items_count + 1):  # Outlook uses 1-based indexing
            try:
                item = items.Item(i)
                
                # Check if it's a mail item (Class = 43)
                try:
                    if item.Class != 43:  # 43 = olMail
                        continue
                except:
                    continue

                subject = ""
                sender_name = ""
                sender_email = ""
                to_emails = ""
                cc_emails = ""
                bcc_emails = ""
                date_utc = None

                try:
                    subject = item.Subject or ""
                except:
                    pass

                try:
                    sender_name = item.SenderName or ""
                except:
                    pass

                try:
                    sender_email = item.SenderEmailAddress or ""
                except:
                    pass

                try:
                    to_emails = item.To or ""
                except:
                    pass

                try:
                    cc_emails = item.CC or ""
                except:
                    pass

                try:
                    bcc_emails = item.BCC or ""
                except:
                    pass

                try:
                    if item.ReceivedTime:
                        date_utc = item.ReceivedTime.isoformat()
                except:
                    pass

                body_text, body_html = get_message_body_outlook(item)
                snippet = extract_snippet(body_text, body_html)

                has_attachments = 0
                attachment_count = 0
                try:
                    attachment_count = item.Attachments.Count
                    has_attachments = 1 if attachment_count > 0 else 0
                except:
                    pass

                # Insert message
                cursor.execute(
                    """INSERT INTO messages 
                       (pst_id, folder_id, subject, sender_name, sender_email, to_emails, 
                        cc_emails, bcc_emails, date_utc, snippet, body_text, body_html, has_attachments)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (pst_id, folder_id, subject, sender_name, sender_email,
                     to_emails, cc_emails, bcc_emails, date_utc, snippet,
                     body_text, body_html, has_attachments)
                )
                message_id = cursor.lastrowid

                # Process attachments
                if has_attachments:
                    for j in range(1, attachment_count + 1):
                        try:
                            attachment = item.Attachments.Item(j)
                            att_data = save_attachment_outlook(attachment, message_id, pst_id)
                            if att_data:
                                cursor.execute(
                                    """INSERT INTO attachments (message_id, filename, mime_type, size_bytes, stored_path)
                                       VALUES (?, ?, ?, ?, ?)""",
                                    (message_id, att_data['filename'], att_data['mime_type'],
                                     att_data['size_bytes'], att_data['stored_path'])
                                )
                        except Exception as e:
                            logger.error(f"Error processing attachment: {e}")
                            continue

                batch_count += 1
                if batch_count % 100 == 0:
                    conn.commit()
                    logger.info(f"Processed {batch_count} messages in {path_display}")

            except Exception as e:
                logger.error(f"Error processing message {i}: {e}")
                continue

        conn.commit()
        
    except Exception as e:
        logger.error(f"Error processing folder items: {e}")

    # Process subfolders
    folder_count = 1
    try:
        for subfolder in folder.Folders:
            folder_count += process_folder_outlook(subfolder, pst_id, folder_id, current_path, conn)
    except Exception as e:
        logger.error(f"Error processing subfolders: {e}")

    return folder_count


def index_pst_file_outlook(pst_path: str, pst_id: str) -> Tuple[int, int]:
    """Index PST file using Outlook COM interface."""
    logger.info(f"Starting Outlook-based indexing of PST: {pst_path}")
    
    # Initialize COM for this thread
    pythoncom.CoInitialize()
    
    try:
        outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
        
        # Add PST file to Outlook
        pst_path_abs = os.path.abspath(pst_path)
        outlook.AddStore(pst_path_abs)
        
        # Find the PST store (it's the last one added)
        pst_store = None
        for store in outlook.Stores:
            if pst_path_abs.lower() in store.FilePath.lower():
                pst_store = store
                break
        
        if not pst_store:
            # Try to get the last added store
            pst_store = outlook.Stores.Item(outlook.Stores.Count)
        
        root_folder = pst_store.GetRootFolder()
        
        with get_db() as conn:
            total_folders = 0
            for folder in root_folder.Folders:
                total_folders += process_folder_outlook(folder, pst_id, None, [], conn)

            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM messages WHERE pst_id = ?", (pst_id,))
            message_count = cursor.fetchone()['count']

        # Remove PST from Outlook to clean up
        try:
            outlook.RemoveStore(root_folder)
        except:
            pass

        logger.info(f"Indexing complete: {total_folders} folders, {message_count} messages")
        return total_folders, message_count
        
    finally:
        pythoncom.CoUninitialize()


def index_pst_file(pst_path: str, pst_id: str) -> Tuple[int, int]:
    """
    Main entry point for PST indexing.
    Uses win32com (Outlook) on Windows, pypff on Linux/WSL.
    """
    # Prefer win32com on Windows as it's easier to install
    if WIN32COM_AVAILABLE:
        logger.info("Using Outlook COM interface for PST parsing")
        return index_pst_file_outlook(pst_path, pst_id)
    
    # Fallback to pypff on Linux/WSL
    if PYPFF_AVAILABLE:
        logger.info("Using pypff for PST parsing")
        return index_pst_file_pypff(pst_path, pst_id)
    
    raise ImportError(
        "No PST parser available. Install either:\n"
        "- pywin32 (Windows with Outlook): pip install pywin32\n"
        "- libpff-python (Linux/WSL): pip install libpff-python"
    )


def index_pst_file_pypff(pst_path: str, pst_id: str) -> Tuple[int, int]:
    """Index PST file using pypff (Linux/WSL)."""
    logger.info(f"Starting pypff-based indexing of PST: {pst_path}")

    pst_file = pypff.file()
    pst_file.open(pst_path)

    root = pst_file.root_folder

    with get_db() as conn:
        total_folders = 0
        for folder in root.sub_folders:
            total_folders += process_folder_pypff(folder, pst_id, None, [], conn)

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM messages WHERE pst_id = ?", (pst_id,))
        message_count = cursor.fetchone()['count']

    pst_file.close()

    logger.info(f"Indexing complete: {total_folders} folders, {message_count} messages")
    return total_folders, message_count


# ========== pypff implementation (for Linux/WSL) ==========

def get_message_body_pypff(message) -> Tuple[Optional[str], Optional[str]]:
    body_text = None
    body_html = None

    try:
        body_text = message.plain_text_body
        if body_text:
            body_text = body_text.decode('utf-8', errors='ignore') if isinstance(body_text, bytes) else str(body_text)
    except:
        pass

    try:
        body_html = message.html_body
        if body_html:
            body_html = body_html.decode('utf-8', errors='ignore') if isinstance(body_html, bytes) else str(body_html)
    except:
        pass

    return body_text, body_html


def parse_transport_headers(headers: str) -> dict:
    """Parse transport headers to extract To, Cc, Bcc fields."""
    result = {'to': '', 'cc': '', 'bcc': ''}
    if not headers:
        return result
    
    current_field = None
    current_value = []
    
    for line in headers.split('\n'):
        line = line.rstrip('\r')
        
        if line.startswith(' ') or line.startswith('\t'):
            if current_field:
                current_value.append(line.strip())
            continue
        
        if current_field and current_value:
            result[current_field] = ' '.join(current_value)
        
        lower_line = line.lower()
        if lower_line.startswith('to:'):
            current_field = 'to'
            current_value = [line[3:].strip()]
        elif lower_line.startswith('cc:'):
            current_field = 'cc'
            current_value = [line[3:].strip()]
        elif lower_line.startswith('bcc:'):
            current_field = 'bcc'
            current_value = [line[4:].strip()]
        else:
            current_field = None
            current_value = []
    
    if current_field and current_value:
        result[current_field] = ' '.join(current_value)
    
    return result


def save_attachment_pypff(attachment, message_id: int, pst_id: str) -> Optional[dict]:
    try:
        filename = attachment.name or "unnamed_attachment"
        size_bytes = attachment.size

        if size_bytes and size_bytes > settings.MAX_ATTACHMENT_MB * 1024 * 1024:
            return {
                'filename': filename,
                'size_bytes': size_bytes,
                'mime_type': None,
                'stored_path': None
            }

        attachment_dir = Path(settings.STORAGE_DIR).resolve() / "attachments" / pst_id / str(message_id)
        attachment_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = filename
        counter = 1
        while (attachment_dir / safe_filename).exists():
            name_parts = filename.rsplit('.', 1)
            if len(name_parts) == 2:
                safe_filename = f"{name_parts[0]}_{counter}.{name_parts[1]}"
            else:
                safe_filename = f"{filename}_{counter}"
            counter += 1

        file_path = attachment_dir / safe_filename
        data = attachment.read_buffer(attachment.size)
        with open(file_path, 'wb') as f:
            f.write(data)

        ext = safe_filename.split('.')[-1].lower() if '.' in safe_filename else None
        mime_map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'txt': 'text/plain',
            'zip': 'application/zip',
        }

        return {
            'filename': safe_filename,
            'size_bytes': size_bytes,
            'mime_type': mime_map.get(ext),
            'stored_path': str(file_path)
        }

    except Exception as e:
        logger.error(f"Error saving attachment: {e}")
        return None


def process_folder_pypff(folder, pst_id: str, parent_id: Optional[int], path_parts: list, conn) -> int:
    cursor = conn.cursor()

    folder_name = folder.name or "Unnamed"
    current_path = path_parts + [folder_name]
    path_display = "/".join(current_path)

    cursor.execute(
        """INSERT OR IGNORE INTO folders (pst_id, name, parent_id, path_display)
           VALUES (?, ?, ?, ?)""",
        (pst_id, folder_name, parent_id, path_display)
    )

    cursor.execute(
        "SELECT id FROM folders WHERE pst_id = ? AND path_display = ?",
        (pst_id, path_display)
    )
    folder_id = cursor.fetchone()['id']

    message_batch_no_attach = []

    for message in folder.sub_messages:
        try:
            subject = message.subject or ""
            sender_name = message.sender_name or ""
            sender_email = message.sender_email_address or ""
            
            transport_headers = ""
            try:
                transport_headers = message.transport_headers or ""
                if isinstance(transport_headers, bytes):
                    transport_headers = transport_headers.decode('utf-8', errors='ignore')
            except:
                pass
            
            parsed_headers = parse_transport_headers(transport_headers)
            to_emails = parsed_headers['to']
            cc_emails = parsed_headers['cc']
            bcc_emails = parsed_headers['bcc']

            date_utc = None
            try:
                if message.delivery_time:
                    date_utc = message.delivery_time.isoformat()
            except:
                pass

            body_text, body_html = get_message_body_pypff(message)
            snippet = extract_snippet(body_text, body_html)

            has_attachments = 1 if message.number_of_attachments > 0 else 0

            message_data = (
                pst_id, folder_id, subject, sender_name, sender_email,
                to_emails, cc_emails, bcc_emails, date_utc, snippet,
                body_text, body_html, has_attachments
            )

            if has_attachments:
                cursor.execute(
                    """INSERT INTO messages 
                       (pst_id, folder_id, subject, sender_name, sender_email, to_emails, 
                        cc_emails, bcc_emails, date_utc, snippet, body_text, body_html, has_attachments)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    message_data
                )
                message_id = cursor.lastrowid
                
                for attachment in message.attachments:
                    try:
                        att_data = save_attachment_pypff(attachment, message_id, pst_id)
                        if att_data:
                            cursor.execute(
                                """INSERT INTO attachments (message_id, filename, mime_type, size_bytes, stored_path)
                                   VALUES (?, ?, ?, ?, ?)""",
                                (message_id, att_data['filename'], att_data['mime_type'], 
                                 att_data['size_bytes'], att_data['stored_path'])
                            )
                    except Exception as e:
                        logger.error(f"Error processing attachment: {e}")
                        continue
            else:
                message_batch_no_attach.append(message_data)

                if len(message_batch_no_attach) >= 200:
                    cursor.executemany(
                        """INSERT INTO messages 
                           (pst_id, folder_id, subject, sender_name, sender_email, to_emails, 
                            cc_emails, bcc_emails, date_utc, snippet, body_text, body_html, has_attachments)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        message_batch_no_attach
                    )
                    conn.commit()
                    message_batch_no_attach = []

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            continue

    if message_batch_no_attach:
        cursor.executemany(
            """INSERT INTO messages 
               (pst_id, folder_id, subject, sender_name, sender_email, to_emails, 
                cc_emails, bcc_emails, date_utc, snippet, body_text, body_html, has_attachments)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            message_batch_no_attach
        )
        conn.commit()

    folder_count = 1

    for sub_folder in folder.sub_folders:
        folder_count += process_folder_pypff(sub_folder, pst_id, folder_id, current_path, conn)

    return folder_count
