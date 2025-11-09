# backend/app/upload.py

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from .db import save_file_locally, insert_chunks, FILES_DIR
from pathlib import Path
import io
import zipfile

router = APIRouter()

# Lazy-load heavy dependencies only when upload is called
_md_converter = None
def get_md_converter():
    global _md_converter
    if _md_converter is None:
        from markitdown import MarkItDown
        _md_converter = MarkItDown()
    return _md_converter

def generate_pdf_thumbnail(file_bytes: bytes, thumbnail_path: Path):
    """Generate a thumbnail (first page) from a PDF."""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(file_bytes, first_page=1, last_page=1, size=(200, 200))
        if images:
            images[0].save(thumbnail_path, format="PNG")
    except Exception as e:
        print(f"Failed to generate PDF thumbnail: {e}")

def generate_text_thumbnail(text: str, thumbnail_path: Path):
    """Generate a thumbnail from the first few lines of text."""
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (200, 200), color=(30, 30, 30))
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()
        lines = text.splitlines()[:10]
        draw.text((10, 10), "\n".join(lines), fill=(255, 255, 255), font=font)
        img.save(thumbnail_path)
    except Exception as e:
        print(f"Failed to generate text thumbnail: {e}")

def generate_image_thumbnail(file_bytes: bytes, thumbnail_path: Path):
    """Resize and save image as thumbnail."""
    try:
        from PIL import Image
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.thumbnail((200, 200))
            img.save(thumbnail_path)
    except Exception as e:
        print(f"Failed to generate image thumbnail: {e}")

# Ensure thumbnails directory exists
THUMBNAILS_DIR = FILES_DIR.parent / "thumbnails"
THUMBNAILS_DIR.mkdir(exist_ok=True)

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """
    Synchronous file upload with processing.
    Frontend will be blocked during processing.
    """
    from .chunker import chunk_text
    from .embedding import generate_embeddings_batch
    md_converter = get_md_converter()
    
    total_chunks = 0

    for file in files:
        try:
            contents = await file.read()
            ext = file.filename.lower().split(".")[-1]

            # Handle ZIP files specially - extract and process contents
            if ext == "zip":
                try:
                    with zipfile.ZipFile(io.BytesIO(contents)) as zf:
                        for zip_file_name in zf.namelist():
                            if zip_file_name.endswith('/'):
                                continue
                            
                            try:
                                zip_contents = zf.read(zip_file_name)
                                saved_path = save_file_locally(zip_contents, zip_file_name)
                                inner_ext = zip_file_name.lower().split(".")[-1]
                                
                                # Generate thumbnail
                                thumbnail_path = THUMBNAILS_DIR / f"{zip_file_name}.png"
                                if inner_ext == "pdf":
                                    generate_pdf_thumbnail(zip_contents, thumbnail_path)
                                elif inner_ext in ("txt", "md"):
                                    try:
                                        md_result = md_converter.convert_stream(io.BytesIO(zip_contents), filename=zip_file_name)
                                        text_content = md_result.text_content
                                        generate_text_thumbnail(text_content, thumbnail_path)
                                    except Exception as e:
                                        pass
                                elif inner_ext in ("png", "jpg", "jpeg"):
                                    generate_image_thumbnail(zip_contents, thumbnail_path)
                                
                                # Extract and chunk
                                try:
                                    md_result = md_converter.convert_stream(io.BytesIO(zip_contents), filename=zip_file_name)
                                    text_content = md_result.text_content
                                    
                                    if text_content:
                                        chunks = chunk_text(text_content)
                                        
                                        if len(chunks) > 2000:
                                            import numpy as np
                                            dummy_embedding = np.zeros(384, dtype='float32')
                                            for chunk in chunks:
                                                insert_chunks(chunk_text=chunk, embedding=dummy_embedding, file_name=zip_file_name)
                                        else:
                                            chunk_with_contexts = [f"[{zip_file_name}] {chunk}" for chunk in chunks]
                                            embeddings = generate_embeddings_batch(chunk_with_contexts)
                                            for chunk, embedding in zip(chunks, embeddings):
                                                insert_chunks(chunk_text=chunk, embedding=embedding, file_name=zip_file_name)
                                        
                                        total_chunks += len(chunks)
                                except Exception as e:
                                    print(f"    Error: {e}")
                            except Exception as e:
                                print(f"  Error with {zip_file_name}: {e}")
                except zipfile.BadZipFile:
                    print(f"Invalid ZIP file")
                continue
            
            # Regular file processing
            saved_path = save_file_locally(contents, file.filename)
            thumbnail_path = THUMBNAILS_DIR / f"{file.filename}.png"
            
            if ext == "pdf":
                generate_pdf_thumbnail(contents, thumbnail_path)
            elif ext in ("txt", "md"):
                try:
                    md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
                    text_content = md_result.text_content
                    generate_text_thumbnail(text_content, thumbnail_path)
                except Exception as e:
                    continue
            elif ext in ("png", "jpg", "jpeg"):
                generate_image_thumbnail(contents, thumbnail_path)
            
            # Extract text
            text_content = None
            try:
                md_result = md_converter.convert_stream(io.BytesIO(contents), filename=file.filename)
                text_content = md_result.text_content
            except Exception as e:
                print(f"Failed to parse {file.filename}: {e}")
                continue
            
            # Chunk and embed
            if text_content:
                chunks = chunk_text(text_content)
                
                if len(chunks) > 2000:
                    print(f"    Skipping embedding (too many chunks)")
                    import numpy as np
                    dummy_embedding = np.zeros(384, dtype='float32')
                    for chunk in chunks:
                        insert_chunks(chunk_text=chunk, embedding=dummy_embedding, file_name=file.filename)
                else:
                    chunk_with_contexts = [f"[{file.filename}] {chunk}" for chunk in chunks]
                    embeddings = generate_embeddings_batch(chunk_with_contexts)
                    for chunk, embedding in zip(chunks, embeddings):
                        insert_chunks(chunk_text=chunk, embedding=embedding, file_name=file.filename)
                
                total_chunks += len(chunks)
        
        except Exception as e:
            print(f"Error processing {file.filename}: {e}")
            import traceback
            traceback.print_exc()

    return JSONResponse(content={"message": f"Uploaded {len(files)} files, {total_chunks} chunks stored."})