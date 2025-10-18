from sentence_transformers import SentenceTransformer
import numpy as np

# Load the model once at startup
# For MVP, we can use a small, fast model like 'all-MiniLM-L6-v2'
model = SentenceTransformer('all-MiniLM-L6-v2')

def generate_embedding(text: str) -> np.ndarray:
    """
    Generates a dense vector embedding for a given text chunk.
    Returns a NumPy array (float32) for storage in SQLite.
    """
    embedding = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.astype('float32')
