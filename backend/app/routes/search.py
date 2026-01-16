from fastapi import APIRouter, Query
from typing import Optional
import re
from ..core.db import get_db
from ..models.schemas import SearchResult, MessageListItem

router = APIRouter()


def parse_search_query(q: str):
    filters = {
        'from': None,
        'to': None,
        'subject': None,
        'folder': None,
        'has_attachment': False,
        'filename': None,
        'after': None,
        'before': None,
        'free_text': []
    }

    tokens = []
    in_quote = False
    current_token = ""

    for char in q:
        if char == '"':
            if in_quote:
                tokens.append(f'"{current_token}"')
                current_token = ""
                in_quote = False
            else:
                if current_token.strip():
                    tokens.append(current_token.strip())
                current_token = ""
                in_quote = True
        elif char == ' ' and not in_quote:
            if current_token.strip():
                tokens.append(current_token.strip())
            current_token = ""
        else:
            current_token += char

    if current_token.strip():
        tokens.append(current_token.strip())

    for token in tokens:
        if ':' in token and not token.startswith('"'):
            key, value = token.split(':', 1)
            key = key.lower()

            if key == 'from':
                filters['from'] = value
            elif key == 'to':
                filters['to'] = value
            elif key == 'subject':
                filters['subject'] = value
            elif key == 'folder':
                filters['folder'] = value.strip('"')
            elif key == 'has' and value == 'attachment':
                filters['has_attachment'] = True
            elif key == 'filename':
                filters['filename'] = value
            elif key == 'after':
                filters['after'] = value
            elif key == 'before':
                filters['before'] = value
        else:
            filters['free_text'].append(token)

    return filters


@router.get("", response_model=SearchResult)
async def search_messages(
    pst_id: str = Query(...),
    q: str = Query(""),
    folder: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = Query("date_desc")
):
    offset = (page - 1) * page_size
    filters = parse_search_query(q)

    if folder:
        filters['folder'] = folder

    with get_db() as conn:
        cursor = conn.cursor()

        use_fts = bool(filters['free_text'])

        if use_fts:
            fts_query = ' '.join(filters['free_text']).replace('"', '""')

            base_query = """
                SELECT m.id, m.subject, m.sender_name, m.sender_email, m.date_utc, 
                       m.snippet, m.has_attachments, f.path_display as folder_path_display
                FROM messages_fts fts
                JOIN messages m ON fts.rowid = m.id
                JOIN folders f ON m.folder_id = f.id
                WHERE m.pst_id = ? AND messages_fts MATCH ?
            """
            params = [pst_id, fts_query]
        else:
            base_query = """
                SELECT m.id, m.subject, m.sender_name, m.sender_email, m.date_utc, 
                       m.snippet, m.has_attachments, f.path_display as folder_path_display
                FROM messages m
                JOIN folders f ON m.folder_id = f.id
                WHERE m.pst_id = ?
            """
            params = [pst_id]

        if filters['from']:
            base_query += " AND (m.sender_email LIKE ? OR m.sender_name LIKE ?)"
            params.extend([f"%{filters['from']}%", f"%{filters['from']}%"])

        if filters['to']:
            base_query += " AND m.to_emails LIKE ?"
            params.append(f"%{filters['to']}%")

        if filters['subject']:
            base_query += " AND m.subject LIKE ?"
            params.append(f"%{filters['subject']}%")

        if filters['folder']:
            base_query += " AND f.path_display LIKE ?"
            params.append(f"%{filters['folder']}%")

        if filters['has_attachment']:
            base_query += " AND m.has_attachments = 1"

        if filters['filename']:
            base_query += """ AND EXISTS (
                SELECT 1 FROM attachments a 
                WHERE a.message_id = m.id AND a.filename LIKE ?
            )"""
            params.append(f"%{filters['filename']}%")

        if filters['after']:
            base_query += " AND m.date_utc >= ?"
            params.append(filters['after'])

        if filters['before']:
            base_query += " AND m.date_utc <= ?"
            params.append(filters['before'])

        count_query = f"SELECT COUNT(*) as total FROM ({base_query})"
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()['total']

        if sort == "relevance" and use_fts:
            # Use FTS5 bm25() for relevance ranking (lower is better, so no DESC)
            base_query += " ORDER BY bm25(messages_fts), m.date_utc DESC"
        else:
            base_query += " ORDER BY m.date_utc DESC"

        base_query += " LIMIT ? OFFSET ?"
        params.extend([page_size, offset])

        cursor.execute(base_query, params)
        rows = cursor.fetchall()

        results = [MessageListItem(**dict(row)) for row in rows]

        return SearchResult(
            results=results,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
