import sqlite3
import numpy as np
from pathlib import Path

DB_PATH = Path(".inkling/index.sqlite")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection():
    """
    Returns a SQLite connection.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def initialize_db():
    """
    Creates tables if they don't exist.
    """
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
    """
    Inserts a chunk and its embedding into the database.
    Also updates the FTS5 table for lexical search.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Convert embedding to bytes for BLOB storage
    embedding_bytes = embedding.tobytes()

    # Insert into chunks table
    cursor.execute(
        "INSERT INTO chunks (file_name, chunk_text, embedding) VALUES (?, ?, ?)",
        (file_name, chunk_text, embedding_bytes)
    )
    chunk_id = cursor.lastrowid

    # Update FTS5 index
    cursor.execute(
        "INSERT INTO chunks_fts (rowid, chunk_text) VALUES (?, ?)",
        (chunk_id, chunk_text)
    )

    conn.commit()
    conn.close()


def fetch_all_chunks():
    """
    Returns all chunks (for debugging/testing).
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_name, chunk_text FROM chunks")
    rows = cursor.fetchall()
    conn.close()
    return rows
