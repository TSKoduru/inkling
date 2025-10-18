from fastapi import FastAPI
from backend.app.upload import router as upload_router
from backend.app.db import initialize_db
from backend.app.debug import router as debug_router

app = FastAPI(title="Inkling MVP")

# Initialize database on startup
initialize_db()

# Include upload routes
app.include_router(upload_router, prefix="/api")
app.include_router(debug_router, prefix="/debug")

# Optional root endpoint for sanity check
@app.get("/")
def root():
    return {"message": "Inkling backend is running"}
