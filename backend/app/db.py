# backend/app/db.py

import sqlite3
import numpy as np
from pathlib import Path
import os
import platform
from datetime import datetime, timezone
import shutil
import uuid

# -------------------------------
# App Data Directory
# -------------------------------

def get_app_data_dir(app_name="Inkling") -> Path:
    system = platform.system()
    if system == "Windows":
        return Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming")) / app_name
    elif system == "Darwin":
        return Path.home() / "Library" / "Application Support" / app_name
    else:  # Linux / other Unix
        return Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share")) / app_name

INKLING_DIR = get_app_data_dir()
INKLING_DIR.mkdir(parents=True, exist_ok=True)

# Database file path
DB_PATH = INKLING_DIR / "index.sqlite"

# Local file storage directory
FILES_DIR = INKLING_DIR / "files"
FILES_DIR.mkdir(exist_ok=True)

# -------------------------------
# Database Helpers
# -------------------------------

def get_connection() -> sqlite3.Connection:
    """Returns a SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def initialize_db():
    """Creates tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()

    # Table for chunks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY,
        file_name TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        date_added TEXT NOT NULL
    );
    """)

    # FTS5 table for lexical search
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        chunk_text,
        content='chunks',
        content_rowid='id'
    );
    """)

    conn.commit()
    conn.close()

# -------------------------------
# File Storage Helpers
# -------------------------------

def save_file_locally(src_path: str, file_name: str) -> Path:
    """
    Copies a file to the local Inkling file store.
    Returns the path to the saved file.
    """
    dest_path = FILES_DIR / file_name
    shutil.copy2(src_path, dest_path)
    return dest_path

# -------------------------------
# Chunking / DB Insert
# -------------------------------

def insert_chunks(chunk_text: str, embedding: np.ndarray, file_name: str):
    """Inserts a chunk and its embedding into the database and updates FTS5."""
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


def fetch_all_chunks():
    """Returns all chunks (for debugging/testing)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_name, chunk_text FROM chunks")
    rows = cursor.fetchall()
    conn.close()
    return rows


def clear_db():
    """Deletes all chunks and resets the FTS table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chunks;")
    cursor.execute("DELETE FROM chunks_fts;")
    conn.commit()
    conn.close()

# -------------------------------
# Ingest File
# -------------------------------

def ingest_file(file_path: str, chunker, embedder):
    """
    Ingests a file into the local store and DB:
    1. Saves it locally
    2. Chunks it
    3. Inserts chunks and embeddings into DB
    """
    original_name = Path(file_path).name
    # Generate a unique filename to prevent collisions
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    local_path = save_file_locally(file_path, unique_name)

    # Split into chunks using user-provided chunker
    chunks = chunker(local_path)  # should return list of strings

    for chunk_text in chunks:
        embedding = embedder(chunk_text)  # should return np.ndarray
        insert_chunks(chunk_text, embedding, unique_name)

    return unique_name  # local stored file name for frontend reference

# -------------------------------
# Fetch stored file path
# -------------------------------

def get_file_path(file_name: str) -> Path:
    """Returns the Path to a locally stored file."""
    return FILES_DIR / file_name
