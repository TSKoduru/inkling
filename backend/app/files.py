# backend/app/files.py

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pathlib import Path
from .db import FILES_DIR, get_file_path

router = APIRouter()
THUMBNAILS_DIR = FILES_DIR.parent / "thumbnails"


@router.post("/open_file")
async def open_file(request: Request):
    data = await request.json()
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    path = get_file_path(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    return FileResponse(path, filename=filename)

@router.get("/thumbnail/{filename}")
async def get_thumbnail(filename: str):
    """
    Returns the thumbnail for a given file.
    Example URL: /thumbnail/example.pdf
    """
    thumb_path = THUMBNAILS_DIR / f"{filename}.png"
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail=f"Thumbnail for {filename} not found")
    return FileResponse(thumb_path, filename=f"{filename}.png")