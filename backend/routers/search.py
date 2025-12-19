from fastapi import APIRouter
from config import supabase
from models.api import SearchRequest

router = APIRouter()

@router.post("/")
def search_documents(request: SearchRequest):
    # Call the SQL function we just wrote
    response = supabase.rpc("keyword_search", {
        "query_text": request.query,
        "filter_user_id": request.user_id
    }).execute()
    
    return {"results": response.data}