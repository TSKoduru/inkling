# backend/app/db.py

import sqlite3
import numpy as np
from pathlib import Path
import os
import platform

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
        embedding BLOB NOT NULL
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


def insert_chunks(chunk_text: str, embedding: np.ndarray, file_name: str):
    """Inserts a chunk and its embedding into the database and updates FTS5."""
    conn = get_connection()
    cursor = conn.cursor()

    embedding_bytes = embedding.tobytes()

    cursor.execute(
        "INSERT INTO chunks (file_name, chunk_text, embedding) VALUES (?, ?, ?)",
        (file_name, chunk_text, embedding_bytes)
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
