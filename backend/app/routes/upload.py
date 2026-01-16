from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import hashlib
import shutil
from datetime import datetime
from ..core.config import settings
from ..core.db import get_db
from ..models.schemas import UploadResponse, PSTStatus
from ..services.pst_parser import index_pst_file

router = APIRouter()


def calculate_file_hash_streaming(file_path: Path) -> str:
    """Calculate SHA256 hash by streaming the file in chunks."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


@router.post("/upload", response_model=UploadResponse)
async def upload_pst(file: UploadFile = File(...)):
    if not file.filename.endswith('.pst'):
        raise HTTPException(status_code=400, detail="Only .pst files are allowed")

    # Create temp storage directory
    storage_dir = Path(settings.STORAGE_DIR) / "pst"
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    # Save file to temp location first using streaming (for large files)
    temp_path = storage_dir / f"temp_{datetime.utcnow().timestamp()}.pst"
    
    try:
        # Stream file to disk in chunks (handles files larger than memory)
        file_size = 0
        with open(temp_path, 'wb') as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                file_size += len(chunk)
                
                # Check size limit while uploading
                if file_size > settings.MAX_UPLOAD_MB * 1024 * 1024:
                    buffer.close()
                    temp_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File size exceeds maximum allowed ({settings.MAX_UPLOAD_MB}MB)"
                    )
                
                buffer.write(chunk)
        
        # Calculate hash from the saved file
        pst_id = calculate_file_hash_streaming(temp_path)
        
        # Check if already exists
        final_path = storage_dir / f"{pst_id}.pst"
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM pst_imports WHERE pst_id = ?", (pst_id,))
            existing = cursor.fetchone()

            if existing:
                # Remove temp file, we already have this PST
                temp_path.unlink(missing_ok=True)
                return UploadResponse(
                    pst_id=pst_id,
                    stored=False,
                    already_indexed=existing['indexed_at'] is not None,
                    message_count=existing['message_count'] or 0,
                    folder_count=existing['folder_count'] or 0
                )

        # Move temp file to final location
        shutil.move(str(temp_path), str(final_path))

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO pst_imports (pst_id, created_at) VALUES (?, ?)",
                (pst_id, datetime.utcnow().isoformat())
            )
            conn.commit()

        try:
            folder_count, message_count = index_pst_file(str(final_path), pst_id)

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """UPDATE pst_imports 
                       SET indexed_at = ?, folder_count = ?, message_count = ?
                       WHERE pst_id = ?""",
                    (datetime.utcnow().isoformat(), folder_count, message_count, pst_id)
                )
                conn.commit()

            return UploadResponse(
                pst_id=pst_id,
                stored=True,
                already_indexed=True,
                message_count=message_count,
                folder_count=folder_count
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error indexing PST: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        # Clean up temp file on error
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/{pst_id}/status", response_model=PSTStatus)
async def get_pst_status(pst_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pst_imports WHERE pst_id = ?", (pst_id,))
        result = cursor.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="PST not found")

        return PSTStatus(
            pst_id=result['pst_id'],
            indexed=result['indexed_at'] is not None,
            message_count=result['message_count'] or 0,
            folder_count=result['folder_count'] or 0,
            created_at=result['created_at'],
            indexed_at=result['indexed_at']
        )
