# backend/app/search.py

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Dict, Any
import numpy as np
import sqlite3
from backend.app.db import get_connection
from backend.app.embedding import generate_embedding
from itertools import groupby
from typing import List, Dict, Any 

router = APIRouter()

# -------------------------------
# Utility functions
# -------------------------------

def _deserialize_embedding(blob: bytes) -> np.ndarray:
    """Convert stored BLOB embeddings back into float32 numpy arrays."""
    return np.frombuffer(blob, dtype=np.float32)


def lexical_search(query: str, top_n: int = 30) -> List[Dict[str, Any]]:
    """
    Performs lexical search using SQLite FTS5.
    Returns a list of dicts with id, file_name, chunk_text, and bm25_score.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.file_name, c.chunk_text, c.date_added, bm25(chunks_fts) AS score
        FROM chunks_fts
        JOIN chunks c ON c.id = chunks_fts.rowid
        WHERE chunks_fts MATCH ?
        ORDER BY score LIMIT ?;
        """, (query, top_n))

    results = [
        {
            "id": r[0],
            "file_name": r[1],
            "chunk_text": r[2],
            "date_added": r[3],
            "bm25_score": r[4]
        }
        for r in cursor.fetchall()
    ]

    conn.close()
    return results


def semantic_search(query: str, top_n: int = 50) -> List[Dict[str, Any]]:
    """
    Computes cosine similarity between the query embedding and all stored embeddings.
    Returns top_n results sorted by similarity.
    """
    query_emb = generate_embedding(query)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, file_name, chunk_text, embedding, date_added FROM chunks;")

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

    ids, files, texts, embeddings, dates = [], [], [], [], []
    for r in rows:
        ids.append(r[0])
        files.append(r[1])
        texts.append(r[2])
        embeddings.append(_deserialize_embedding(r[3]))
        dates.append(r[4])


    embeddings = np.vstack(embeddings)
    similarities = np.dot(embeddings, query_emb)

    top_indices = np.argsort(similarities)[::-1][:top_n]

    results = [
    {
        "id": ids[i],
        "file_name": files[i],
        "chunk_text": texts[i],
        "similarity": float(similarities[i]),
        "date_added": dates[i],
    }
        for i in top_indices
    ]
    
    return results


def reciprocal_rank_fusion(
    lexical: List[Dict[str, Any]],
    semantic: List[Dict[str, Any]],
    k: int = 60,
    rrf_k: float = 60.0,
    max_snippets_per_file: int = 3,
    min_rrf_score: float = 0,  # configurable cutoff
) -> List[Dict[str, Any]]:
    """
    Combines lexical and semantic rankings using Reciprocal Rank Fusion (RRF),
    merges top chunks per file, and filters out low-confidence results.
    """
    scores = {}

    # Compute RRF scores
    for rank, doc in enumerate(lexical):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (rrf_k + rank + 1)
    for rank, doc in enumerate(semantic):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (rrf_k + rank + 1)

    all_docs = {doc["id"]: doc for doc in lexical + semantic}
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    # Add metadata back
    fused_results = [
        {
            "id": doc_id,
            "file_name": all_docs[doc_id]["file_name"],
            "chunk_text": all_docs[doc_id]["chunk_text"],
            "date_added": all_docs[doc_id].get("date_added"),
            "rrf_score": float(score),
        }
        for doc_id, score in ranked
        if score >= min_rrf_score  # 🔹 filter out weak results
    ]

    # Group by file_name
    grouped = {}
    for doc in fused_results:
        fname = doc["file_name"]
        grouped.setdefault(fname, []).append(doc)

    # Keep only the top chunk per file
    merged_results = []
    for fname, docs in grouped.items():
        top_doc = max(docs, key=lambda x: x["rrf_score"])
        merged_results.append({
            "file_name": fname,
            "id": top_doc["id"],
            "chunk_text": top_doc["chunk_text"].strip(),
            "rrf_score": top_doc["rrf_score"],
            "date_added": top_doc.get("date_added"), 
        })



    # Sort by score and cap to top k
    merged_results.sort(key=lambda x: x["rrf_score"], reverse=True)
    return merged_results[: min(k, len(merged_results))]

# -------------------------------
# API models and routes
# -------------------------------

class SearchResponse(BaseModel):
    id: int
    file_name: str
    chunk_text: str
    rrf_score: float
    date_added: str

@router.get("/search", response_model=List[SearchResponse])
def search_endpoint(query: str = Query(..., min_length=1), top_k: int = 10):
    """
    Unified search endpoint:
      1. Runs FTS5 lexical search
      2. Runs embedding-based semantic search
      3. Combines via Reciprocal Rank Fusion (RRF)
    """
    lexical_results = lexical_search(query, top_n=top_k * 3)
    semantic_results = semantic_search(query, top_n=top_k * 3)
    fused = reciprocal_rank_fusion(lexical_results, semantic_results, k=top_k)

    return fused
