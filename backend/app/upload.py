# backend/app/upload.py

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from .db import save_file_locally, insert_chunks
from .chunker import chunk_text
from .embedding import generate_embedding
import io
from markitdown import MarkItDown

router = APIRouter()
md_converter = MarkItDown()

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    total_chunks = 0

    for file in files:
        contents = await file.read()

        # Save file locally
        saved_path = save_file_locally(contents, file.filename)

        # Convert file to text
        try:
            md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
            text = md_result.text_content
        except Exception as e:
            return JSONResponse(status_code=400, content={"error": f"Failed to parse {file.filename}: {str(e)}"})

        # Chunk and insert into DB
        chunks = chunk_text(text)
        chunks.append(file.filename)  # Keep filename context
        for chunk in chunks:
            embedding = generate_embedding(chunk)
            insert_chunks(chunk_text=chunk, embedding=embedding, file_name=file.filename)

        total_chunks += len(chunks)

    return JSONResponse(content={"message": f"Uploaded {len(files)} files, {total_chunks} chunks stored."})
