from markitdown import MarkItDown
from pathlib import Path

# Initialize MarkItDown once
md_converter = MarkItDown()

def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    """
    Converts a file (PDF, DOCX, TXT, MD, etc.) to Markdown text using MarkItDown.
    """
    text = md_converter.convert_stream(file_bytes, filename=filename)
    return text
