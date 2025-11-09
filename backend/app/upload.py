# backend/app/upload.py

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from .db import save_file_locally, insert_chunks, FILES_DIR
from .chunker import chunk_text
from .embedding import generate_embedding
import io
from markitdown import MarkItDown
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pdf2image import convert_from_bytes

router = APIRouter()
md_converter = MarkItDown()

# Ensure thumbnails directory exists
THUMBNAILS_DIR = FILES_DIR.parent / "thumbnails"
THUMBNAILS_DIR.mkdir(exist_ok=True)

def generate_pdf_thumbnail(file_bytes: bytes, thumbnail_path: Path):
    """Generate a thumbnail (first page) from a PDF."""
    try:
        images = convert_from_bytes(file_bytes, first_page=1, last_page=1, size=(200, 200))
        images[0].save(thumbnail_path, format="PNG")
    except Exception as e:
        print(f"Failed to generate PDF thumbnail: {e}")

def generate_text_thumbnail(text: str, thumbnail_path: Path):
    """Generate a thumbnail from the first few lines of text."""
    try:
        img = Image.new('RGB', (200, 200), color=(30, 30, 30))
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()
        lines = text.splitlines()[:10]  # first 10 lines
        draw.text((10, 10), "\n".join(lines), fill=(255, 255, 255), font=font)
        img.save(thumbnail_path)
    except Exception as e:
        print(f"Failed to generate text thumbnail: {e}")

def generate_image_thumbnail(file_bytes: bytes, thumbnail_path: Path):
    """Resize and save image as thumbnail."""
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.thumbnail((200, 200))
            img.save(thumbnail_path)
    except Exception as e:
        print(f"Failed to generate image thumbnail: {e}")

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    total_chunks = 0

    for file in files:
        contents = await file.read()

        # Save file locally
        saved_path = save_file_locally(contents, file.filename)

        # Get file extension
        ext = file.filename.lower().split(".")[-1]

        # Generate thumbnail
        thumbnail_path = THUMBNAILS_DIR / f"{file.filename}.png"
        if ext == "pdf":
            generate_pdf_thumbnail(contents, thumbnail_path)
        elif ext in ("txt", "md"):
            try:
                md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
                text_content = md_result.text_content
            except Exception as e:
                return JSONResponse(status_code=400, content={"error": f"Failed to parse {file.filename}: {str(e)}"})
            generate_text_thumbnail(text_content, thumbnail_path)
        elif ext in ("png", "jpg", "jpeg"):
            generate_image_thumbnail(contents, thumbnail_path)

        # Convert file to text for chunking
        text_content = None
        if ext in ("txt", "md"):
            try:
                md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
                text_content = md_result.text_content
            except Exception as e:
                return JSONResponse(status_code=400, content={"error": f"Failed to parse {file.filename}: {str(e)}"})
        else:
            try:
                md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
                text_content = md_result.text_content
            except Exception as e:
                return JSONResponse(status_code=400, content={"error": f"Failed to parse {file.filename}: {str(e)}"})

        # Chunk the text (do NOT append filename to chunks)
        if text_content:
            chunks = chunk_text(text_content)
            for chunk in chunks:
                embedding = generate_embedding(chunk)
                insert_chunks(chunk_text=chunk, embedding=embedding, file_name=file.filename)
            total_chunks += len(chunks)

    return JSONResponse(content={"message": f"Uploaded {len(files)} files, {total_chunks} chunks stored."})