from sentence_transformers import SentenceTransformer
import numpy as np

# Lazy-load the model only when first needed
_model = None

def get_model():
    """Lazy-load the SentenceTransformer model."""
    global _model
    if _model is None:
        print("Loading SentenceTransformer model...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Model loaded.")
    return _model

def generate_embedding(text: str) -> np.ndarray:
    """
    Generates a dense vector embedding for a given text chunk.
    Returns a NumPy array (float32) for storage in SQLite.
    """
    model = get_model()
    embedding = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.astype('float32')

def generate_embeddings_batch(texts: list[str]) -> list[np.ndarray]:
    """
    Generates embeddings for multiple texts at once (much faster).
    Returns a list of NumPy arrays (float32).
    """
    if not texts:
        return []
    model = get_model()
    # Use larger batch size for faster processing
    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, batch_size=256)
    return [e.astype('float32') for e in embeddings]