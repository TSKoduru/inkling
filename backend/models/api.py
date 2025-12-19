# backend/models/api.py
from pydantic import BaseModel
from typing import List, Optional

class SearchRequest(BaseModel):
    query: str
    user_id: str
    limit: int = 5

class SearchResponse(BaseModel):
    results: List[dict]
    latency_ms: float

class GoogleConnectRequest(BaseModel):
    code: str
    user_id: str
    service: str = "google_drive" # Default to drive if missing