# backend/app/upload.py

from fastapi import APIRouter, UploadFile, File
from .chunker import chunk_text
from .db import insert_chunks
from .embedding import generate_embedding
import io
import numpy as np
from fastapi.responses import JSONResponse

# Import MarkItDown for file parsing
from markitdown import MarkItDown

router = APIRouter()
md_converter = MarkItDown()

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    total_chunks = 0

    for file in files:
        contents = await file.read()
        stream = io.BytesIO(contents)

        try:
            md_result = md_converter.convert_stream(stream, filename=file.filename)
            text = md_result.text_content
        except Exception as e:
            return JSONResponse(status_code=400, content={"error": f"Failed to parse {file.filename}: {str(e)}"})

        chunks = chunk_text(text)
        for chunk in chunks:
            embedding = generate_embedding(chunk)
            insert_chunks(chunk_text=chunk, embedding=embedding, file_name=file.filename)

        total_chunks += len(chunks)

    return JSONResponse(content={"message": f"Uploaded {len(files)} files, {total_chunks} chunks stored."})
