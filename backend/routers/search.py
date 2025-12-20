from fastapi import APIRouter
from config import supabase
from models.api import SearchRequest
from services.embeddings import generate_embedding

router = APIRouter()

@router.post("/")
def search_documents(request: SearchRequest):
    # 1. Generate the vector for the user's query
    try:
        query_vector = generate_embedding(request.query)
    except Exception as e:
        print(f"Embedding Error: {e}")
        return {"results": [], "error": "Failed to generate embedding"}

    # 2. Get a large pool of matches (we will filter duplicates next)
    # Lower threshold to 0.3 to allow fuzzier matches
    response = supabase.rpc("match_documents", {
        "query_embedding": query_vector,
        "filter_user_id": request.user_id,
        "match_threshold": 0.1, 
        "match_count": 50 
    }).execute()
    
    raw_results = response.data
    
    # 3. Deduplicate: Keep only the BEST chunk per Document
    seen_docs = set()
    unique_results = []
    
    for item in raw_results:
        doc_id = item['document_id']
        if doc_id not in seen_docs:
            seen_docs.add(doc_id)
            unique_results.append(item)
            
        # Stop once we have enough unique results
        if len(unique_results) >= request.limit:
            break
    
    return {"results": unique_results}