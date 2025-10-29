from fastapi import APIRouter
from backend.app.db import get_connection

router = APIRouter()

@router.get("/stats")
def get_stats():
    """
    Returns basic system stats, e.g. total number of unique files.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Count distinct files in the chunks table
    cursor.execute("SELECT COUNT(DISTINCT file_name) FROM chunks;")
    total_documents = cursor.fetchone()[0] or 0

    conn.close()
    return {"total_documents": total_documents}
