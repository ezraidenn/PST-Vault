from fastapi import APIRouter, HTTPException, Query
from typing import List
from ..core.db import get_db
from ..models.schemas import MessageListItem, MessageDetail, AttachmentInfo

router = APIRouter()


@router.get("", response_model=List[MessageListItem])
async def get_messages(
    pst_id: str = Query(...),
    folder_id: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    offset = (page - 1) * page_size

    with get_db() as conn:
        cursor = conn.cursor()

        if folder_id:
            query = """
                SELECT m.id, m.subject, m.sender_name, m.sender_email, m.date_utc, 
                       m.snippet, m.has_attachments, f.path_display as folder_path_display
                FROM messages m
                JOIN folders f ON m.folder_id = f.id
                WHERE m.pst_id = ? AND m.folder_id = ?
                ORDER BY m.date_utc DESC
                LIMIT ? OFFSET ?
            """
            cursor.execute(query, (pst_id, folder_id, page_size, offset))
        else:
            query = """
                SELECT m.id, m.subject, m.sender_name, m.sender_email, m.date_utc, 
                       m.snippet, m.has_attachments, f.path_display as folder_path_display
                FROM messages m
                JOIN folders f ON m.folder_id = f.id
                WHERE m.pst_id = ?
                ORDER BY m.date_utc DESC
                LIMIT ? OFFSET ?
            """
            cursor.execute(query, (pst_id, page_size, offset))

        rows = cursor.fetchall()
        return [MessageListItem(**dict(row)) for row in rows]


@router.get("/{message_id}", response_model=MessageDetail)
async def get_message_detail(message_id: int):
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT m.*, f.path_display as folder_path_display
            FROM messages m
            JOIN folders f ON m.folder_id = f.id
            WHERE m.id = ?
        """, (message_id,))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Message not found")

        message_data = dict(row)

        cursor.execute("""
            SELECT id, filename, mime_type, size_bytes
            FROM attachments
            WHERE message_id = ?
        """, (message_id,))

        attachments = [AttachmentInfo(**dict(att)) for att in cursor.fetchall()]
        message_data['attachments'] = attachments

        return MessageDetail(**message_data)
