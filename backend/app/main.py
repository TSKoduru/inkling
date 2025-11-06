from fastapi import FastAPI
import uvicorn
from backend.app.upload import router as upload_router
from backend.app.db import initialize_db
from backend.app.debug import router as debug_router
from backend.app.search import router as search_router
from backend.app.stats import router as stats
from backend.app.files import router as files
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI(title="Inkling MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local dev; restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Initialize database on startup
initialize_db()

# Include all routes
app.include_router(upload_router, prefix="/api")
app.include_router(debug_router, prefix="/debug")
app.include_router(search_router, prefix="/api")
app.include_router(stats, prefix="/api")
app.include_router(files, prefix="/api")

# Optional root endpoint for sanity check
@app.get("/")
def root():
    return {"message": "Inkling backend is running"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
