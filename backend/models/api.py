from pydantic import BaseModel
from typing import List, Optional

class SearchRequest(BaseModel):
    query: str
    user_id: str
    limit: int = 5

class SearchResponse(BaseModel):
    results: List[dict]
    latency_ms: float