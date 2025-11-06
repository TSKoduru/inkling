# backend/app/files.py

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from .db import get_file_path
import logging

router = APIRouter()

# Set up logging
logger = logging.getLogger("files")
logging.basicConfig(level=logging.DEBUG)

@router.post("/open_file")
async def open_file(request: Request):
    data = await request.json()
    filename = data.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    print("[DEBUG] open_file called with filename:", filename)
    path = get_file_path(filename)
    print("[DEBUG] Resolved path:", path.resolve())

    if not path.exists():
        print("[ERROR] File not found at path:", path.resolve())
        raise HTTPException(status_code=404, detail=f"File {filename} not found")

    print("[INFO] Returning file:", path.resolve())
    return FileResponse(path, filename=filename)
