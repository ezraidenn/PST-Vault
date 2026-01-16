import sqlite3
import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator
from .config import settings


def get_db_path() -> str:
    db_path = Path(settings.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(db_path)


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pst_imports (
            pst_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            indexed_at TEXT,
            folder_count INTEGER DEFAULT 0,
            message_count INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pst_id TEXT NOT NULL,
            name TEXT NOT NULL,
            parent_id INTEGER,
            path_display TEXT NOT NULL,
            UNIQUE(pst_id, path_display),
            FOREIGN KEY (parent_id) REFERENCES folders(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pst_id TEXT NOT NULL,
            folder_id INTEGER NOT NULL,
            subject TEXT,
            sender_name TEXT,
            sender_email TEXT,
            to_emails TEXT,
            cc_emails TEXT,
            bcc_emails TEXT,
            date_utc TEXT,
            snippet TEXT,
            body_text TEXT,
            body_html TEXT,
            has_attachments INTEGER DEFAULT 0,
            FOREIGN KEY (folder_id) REFERENCES folders(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            mime_type TEXT,
            size_bytes INTEGER,
            stored_path TEXT,
            FOREIGN KEY (message_id) REFERENCES messages(id)
        )
    """)

    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            subject,
            sender_name,
            sender_email,
            to_emails,
            cc_emails,
            body_text,
            content='messages',
            content_rowid='id'
        )
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, subject, sender_name, sender_email, to_emails, cc_emails, body_text)
            VALUES (new.id, new.subject, new.sender_name, new.sender_email, new.to_emails, new.cc_emails, new.body_text);
        END
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
            DELETE FROM messages_fts WHERE rowid = old.id;
        END
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
            UPDATE messages_fts SET 
                subject = new.subject,
                sender_name = new.sender_name,
                sender_email = new.sender_email,
                to_emails = new.to_emails,
                cc_emails = new.cc_emails,
                body_text = new.body_text
            WHERE rowid = new.id;
        END
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_pst_id ON messages(pst_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_folder_id ON messages(folder_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_date_utc ON messages(date_utc)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_pst_id ON folders(pst_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id)")

    conn.commit()
    conn.close()
