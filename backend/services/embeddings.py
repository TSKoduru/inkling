from sentence_transformers import SentenceTransformer

# Load model once at startup (caching it)
model = SentenceTransformer('all-MiniLM-L6-v2')

def generate_embedding(text: str):
    # Returns a list of floats (384 dimensions)
    return model.encode(text).tolist()