from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict
from ..core.db import get_db
from ..models.schemas import FolderNode

router = APIRouter()


def build_folder_tree(folders: List[Dict]) -> List[FolderNode]:
    folder_map = {}
    root_folders = []

    for folder in folders:
        node = FolderNode(
            id=folder['id'],
            name=folder['name'],
            path_display=folder['path_display'],
            children=[]
        )
        folder_map[folder['id']] = node

    for folder in folders:
        node = folder_map[folder['id']]
        if folder['parent_id'] is None:
            root_folders.append(node)
        else:
            parent = folder_map.get(folder['parent_id'])
            if parent:
                parent.children.append(node)

    return root_folders


@router.get("", response_model=List[FolderNode])
async def get_folders(pst_id: str = Query(...)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, parent_id, path_display FROM folders WHERE pst_id = ? ORDER BY path_display",
            (pst_id,)
        )
        rows = cursor.fetchall()

        if not rows:
            return []

        folders = [dict(row) for row in rows]
        return build_folder_tree(folders)
