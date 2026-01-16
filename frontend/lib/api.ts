const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UploadResponse {
  pst_id: string;
  stored: boolean;
  already_indexed: boolean;
  message_count: number;
  folder_count: number;
}

export interface PSTStatus {
  pst_id: string;
  indexed: boolean;
  message_count: number;
  folder_count: number;
  created_at?: string;
  indexed_at?: string;
}

export interface FolderNode {
  id: number;
  name: string;
  path_display: string;
  children: FolderNode[];
}

export interface AttachmentInfo {
  id: number;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface MessageListItem {
  id: number;
  folder_path_display: string;
  subject?: string;
  sender_name?: string;
  sender_email?: string;
  date_utc?: string;
  snippet?: string;
  has_attachments: number;
}

export interface MessageDetail {
  id: number;
  pst_id: string;
  folder_id: number;
  folder_path_display: string;
  subject?: string;
  sender_name?: string;
  sender_email?: string;
  to_emails?: string;
  cc_emails?: string;
  bcc_emails?: string;
  date_utc?: string;
  body_text?: string;
  body_html?: string;
  has_attachments: number;
  attachments: AttachmentInfo[];
}

export interface SearchResult {
  results: MessageListItem[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface ExportRequest {
  pst_id: string;
  message_ids: number[];
  format: string;
  include_attachments: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async uploadPST(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/pst/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async getPSTStatus(pstId: string): Promise<PSTStatus> {
    const response = await fetch(`${this.baseUrl}/pst/${pstId}/status`);

    if (!response.ok) {
      throw new Error('Failed to get PST status');
    }

    return response.json();
  }

  async getFolders(pstId: string): Promise<FolderNode[]> {
    const response = await fetch(`${this.baseUrl}/folders?pst_id=${pstId}`);

    if (!response.ok) {
      throw new Error('Failed to get folders');
    }

    return response.json();
  }

  async getMessages(
    pstId: string,
    folderId?: number,
    page: number = 1,
    pageSize: number = 50
  ): Promise<MessageListItem[]> {
    let url = `${this.baseUrl}/messages?pst_id=${pstId}&page=${page}&page_size=${pageSize}`;
    if (folderId) {
      url += `&folder_id=${folderId}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to get messages');
    }

    return response.json();
  }

  async getMessageDetail(messageId: number): Promise<MessageDetail> {
    const response = await fetch(`${this.baseUrl}/messages/${messageId}`);

    if (!response.ok) {
      throw new Error('Failed to get message detail');
    }

    return response.json();
  }

  async searchMessages(
    pstId: string,
    query: string,
    folder?: string,
    page: number = 1,
    pageSize: number = 50,
    sort: string = 'date_desc'
  ): Promise<SearchResult> {
    let url = `${this.baseUrl}/search?pst_id=${pstId}&q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}&sort=${sort}`;
    if (folder) {
      url += `&folder=${encodeURIComponent(folder)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to search messages');
    }

    return response.json();
  }

  async downloadMessage(messageId: number, format: 'eml' | 'json' = 'eml'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/messages/${messageId}/download?format=${format}`);

    if (!response.ok) {
      throw new Error('Failed to download message');
    }

    return response.blob();
  }

  async exportMessages(request: ExportRequest): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/messages/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to export messages');
    }

    return response.blob();
  }
}

export const apiClient = new ApiClient(API_URL);
