from sentence_transformers import SentenceTransformer
import numpy as np

# Lazy-load the model only when first needed
_model = None

def get_model():
    """Lazy-load the SentenceTransformer model."""
    global _model
    if _model is None:
        print("Loading SentenceTransformer model (this happens once)...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Model loaded successfully!")
    return _model

def generate_embedding(text: str) -> np.ndarray:
    """
    Generates a dense vector embedding for a given text chunk.
    Returns a NumPy array (float32) for storage in SQLite.
    """
    model = get_model()
    embedding = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.astype('float32')