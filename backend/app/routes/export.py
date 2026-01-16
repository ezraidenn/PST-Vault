from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List
import json
import io
import zipfile
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email import utils as email_utils
from datetime import datetime
from pathlib import Path
from ..core.db import get_db
from ..models.schemas import ExportRequest

router = APIRouter()


def generate_eml(message_data: dict) -> str:
    msg = MIMEMultipart()

    msg['Subject'] = message_data.get('subject', 'No Subject')
    msg['From'] = f"{message_data.get('sender_name', '')} <{message_data.get('sender_email', '')}>"
    msg['To'] = message_data.get('to_emails', '')

    if message_data.get('cc_emails'):
        msg['Cc'] = message_data['cc_emails']

    if message_data.get('date_utc'):
        try:
            dt = datetime.fromisoformat(message_data['date_utc'].replace('Z', '+00:00'))
            msg['Date'] = email_utils.format_datetime(dt)
        except:
            pass

    if message_data.get('body_html'):
        msg.attach(MIMEText(message_data['body_html'], 'html'))
    elif message_data.get('body_text'):
        msg.attach(MIMEText(message_data['body_text'], 'plain'))
    else:
        msg.attach(MIMEText('', 'plain'))

    return msg.as_string()


def sanitize_filename(filename: str) -> str:
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename[:200]


@router.get("/{message_id}/download")
async def download_message(message_id: int, format: str = "eml"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM messages WHERE id = ?", (message_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        message_data = dict(row)

        if format == "json":
            cursor.execute("SELECT * FROM attachments WHERE message_id = ?", (message_id,))
            attachments = [dict(att) for att in cursor.fetchall()]
            message_data['attachments'] = attachments

            return JSONResponse(content=message_data)

        elif format == "eml":
            eml_content = generate_eml(message_data)
            subject = message_data.get('subject', 'message')
            filename = sanitize_filename(f"{subject}_{message_id}.eml")

            return StreamingResponse(
                io.BytesIO(eml_content.encode('utf-8')),
                media_type="message/rfc822",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )

        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'eml' or 'json'")


@router.post("/export")
async def export_messages(request: ExportRequest):
    if not request.message_ids:
        raise HTTPException(status_code=400, detail="No message IDs provided")

    with get_db() as conn:
        cursor = conn.cursor()

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for msg_id in request.message_ids:
                cursor.execute(
                    "SELECT * FROM messages WHERE id = ? AND pst_id = ?",
                    (msg_id, request.pst_id)
                )
                row = cursor.fetchone()

                if not row:
                    continue

                message_data = dict(row)

                if request.format == "eml":
                    eml_content = generate_eml(message_data)
                    subject = message_data.get('subject', 'message')
                    date_str = message_data.get('date_utc', '').split('T')[0] if message_data.get('date_utc') else 'nodate'
                    filename = sanitize_filename(f"{date_str}_{subject}_{msg_id}.eml")

                    zip_file.writestr(filename, eml_content)

                    if request.include_attachments:
                        cursor.execute("SELECT * FROM attachments WHERE message_id = ?", (msg_id,))
                        attachments = cursor.fetchall()

                        for att in attachments:
                            if att['stored_path'] and Path(att['stored_path']).exists():
                                att_filename = sanitize_filename(att['filename'])
                                folder_name = sanitize_filename(f"{date_str}_{subject}_{msg_id}")
                                zip_file.write(
                                    att['stored_path'],
                                    f"{folder_name}/{att_filename}"
                                )

                elif request.format == "json":
                    cursor.execute("SELECT * FROM attachments WHERE message_id = ?", (msg_id,))
                    message_data['attachments'] = [dict(att) for att in cursor.fetchall()]

                    filename = sanitize_filename(f"message_{msg_id}.json")
                    zip_file.writestr(filename, json.dumps(message_data, indent=2))

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=messages_export.zip"}
        )
