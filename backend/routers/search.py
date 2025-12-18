# backend/routers/search.py
from fastapi import APIRouter
from config import supabase

router = APIRouter()

@router.get("/")
def search_documents(query: str):
    return {"message": f"Searching for: {query}", "db_status": "connected"}