from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pathlib import Path
from ..core.db import get_db

router = APIRouter()

@router.get("/{attachment_id}/download")
async def download_attachment(attachment_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attachments WHERE id = ?", (attachment_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Attachment not found")

        attachment = dict(row)

        if not attachment.get('stored_path') or not Path(attachment['stored_path']).exists():
            raise HTTPException(status_code=404, detail="Attachment file not found")

        file_path = Path(attachment['stored_path'])
        filename = attachment['filename']

        def file_generator():
            with open(file_path, 'rb') as f:
                while chunk := f.read(8192):
                    yield chunk

        return StreamingResponse(
            file_generator(),
            media_type='application/octet-stream',
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
