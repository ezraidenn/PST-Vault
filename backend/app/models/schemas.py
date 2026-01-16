from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UploadResponse(BaseModel):
    pst_id: str
    stored: bool
    already_indexed: bool
    message_count: int
    folder_count: int


class PSTStatus(BaseModel):
    pst_id: str
    indexed: bool
    message_count: int
    folder_count: int
    created_at: Optional[str] = None
    indexed_at: Optional[str] = None


class FolderNode(BaseModel):
    id: int
    name: str
    path_display: str
    children: List['FolderNode'] = []


class AttachmentInfo(BaseModel):
    id: int
    filename: str
    mime_type: Optional[str]
    size_bytes: Optional[int]


class MessageListItem(BaseModel):
    id: int
    folder_path_display: str
    subject: Optional[str]
    sender_name: Optional[str]
    sender_email: Optional[str]
    date_utc: Optional[str]
    snippet: Optional[str]
    has_attachments: int


class MessageDetail(BaseModel):
    id: int
    pst_id: str
    folder_id: int
    folder_path_display: str
    subject: Optional[str]
    sender_name: Optional[str]
    sender_email: Optional[str]
    to_emails: Optional[str]
    cc_emails: Optional[str]
    bcc_emails: Optional[str]
    date_utc: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    has_attachments: int
    attachments: List[AttachmentInfo] = []


class SearchResult(BaseModel):
    results: List[MessageListItem]
    total_count: int
    page: int
    page_size: int


class ExportRequest(BaseModel):
    pst_id: str
    message_ids: List[int]
    format: str = "eml"
    include_attachments: bool = False
