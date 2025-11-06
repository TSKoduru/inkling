# backend/app/db.py

import sqlite3
import numpy as np
from pathlib import Path
import shutil
from datetime import datetime, timezone

# -------------------------------
# App Data Directory (fixed to Documents)
# -------------------------------

INKLING_DIR = Path.home() / "Documents" / "Inkling"
FILES_DIR = INKLING_DIR / "files"

# Ensure directories exist
FILES_DIR.mkdir(parents=True, exist_ok=True)

# Database file path
DB_PATH = INKLING_DIR / "index.sqlite"

# -------------------------------
# Database Helpers
# -------------------------------

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def initialize_db():
    """Creates tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY,
        file_name TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        date_added TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        chunk_text,
        content='chunks',
        content_rowid='id'
    );
    """)

    conn.commit()
    conn.close()

def clear_db(): 
    """Deletes all chunks and resets the FTS table.""" 
    conn = get_connection() 
    cursor = conn.cursor() 
    cursor.execute("DELETE FROM chunks;") 
    cursor.execute("DELETE FROM chunks_fts;") 
    conn.commit() 
    conn.close()

# -------------------------------
# File Storage Helpers
# -------------------------------

def save_file_locally(src_bytes: bytes, file_name: str) -> Path:
    """
    Saves uploaded file bytes to FILES_DIR.
    Returns the path to the saved file.
    """
    dest_path = FILES_DIR / file_name
    with open(dest_path, "wb") as fh:
        fh.write(src_bytes)
    return dest_path

def get_file_path(file_name: str) -> Path:
    """Returns the Path to a locally stored file."""
    return FILES_DIR / file_name

# -------------------------------
# Chunk / DB Insert
# -------------------------------

def insert_chunks(chunk_text: str, embedding: np.ndarray, file_name: str):
    conn = get_connection()
    cursor = conn.cursor()

    embedding_bytes = embedding.tobytes()
    date_added = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        "INSERT INTO chunks (file_name, chunk_text, embedding, date_added) VALUES (?, ?, ?, ?)",
        (file_name, chunk_text, embedding_bytes, date_added)
    )
    chunk_id = cursor.lastrowid

    cursor.execute(
        "INSERT INTO chunks_fts (rowid, chunk_text) VALUES (?, ?)",
        (chunk_id, chunk_text)
    )

    conn.commit()
    conn.close()
