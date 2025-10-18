from fastapi import APIRouter
from backend.app.db import get_connection

router = APIRouter()

@router.get("/chunks")
def list_chunks(limit: int = 10):
    """
    Debug endpoint to list stored chunks.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_name, chunk_text FROM chunks LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "file_name": r[1],
            "chunk_text": r[2][:200] + ("..." if len(r[2]) > 200 else "")
        }
        for r in rows
    ]
