# backend/app/chunker.py

from transformers import AutoTokenizer
import semchunk

# Initialize tokenizer
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

# token_counter must return an integer
def token_counter(text: str) -> int:
    return len(tokenizer.encode(text))

# Create the semantic chunker
chunker = semchunk.chunkerify(token_counter, chunk_size=500)

def chunk_text(text: str):
    """
    Splits the input text into semantically meaningful chunks using semchunk.
    Returns a list of chunk strings.
    """
    if not text:
        return []

    chunks = chunker(text)  # returns list of strings
    return [c.strip() for c in chunks if c.strip()]


# Optional quick test
if __name__ == "__main__":
    sample_text = "This is a test.\nHere is another line.\nAnd one more paragraph."
    out = chunk_text(sample_text)
    print("Chunks:", len(out))
    for i, c in enumerate(out, 1):
        print(f"--- Chunk {i} ---")
        print(c)
