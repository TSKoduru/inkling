# backend/app/upload.py

from fastapi import APIRouter, UploadFile, File
from .chunker import chunk_text
from .db import insert_chunks
import io
import numpy as np

# Import MarkItDown for file parsing
from markitdown import MarkItDown

router = APIRouter()
md_converter = MarkItDown()

def embed_text(text: str) -> np.ndarray:
    """
    Dummy embedding function for MVP.
    Replace with your SentenceTransformer embeddings later.
    """
    return np.random.rand(384).astype(np.float32)

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    total_chunks = 0

    for file in files:
        contents = await file.read()
        stream = io.BytesIO(contents)

        # Convert file to Markdown / plain text
        try:
            md_result = md_converter.convert_stream(stream, filename=file.filename)
            text = md_result.text_content
        except Exception as e:
            return {"error": f"Failed to parse {file.filename}: {str(e)}"}

        # Generate semantic chunks from extracted text
        chunks = chunk_text(text)

        # Insert chunks + embeddings into DB
        for chunk in chunks:
            embedding = embed_text(chunk)
            insert_chunks(chunk_text=chunk, embedding=embedding, file_name=file.filename)

        total_chunks += len(chunks)

    return {"message": f"Uploaded {len(files)} files, {total_chunks} chunks stored."}
