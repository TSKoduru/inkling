"""
FastAPI app with lazy-loaded heavy dependencies.
"""
import sys
import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Quick port file write BEFORE anything else
port = None
port_file = None
if len(sys.argv) > 1:
    port_file = sys.argv[1]
    with socket.socket() as s:
        s.bind(("", 0))
        port = s.getsockname()[1]
    with open(port_file, "w") as f:
        f.write(str(port))

# Minimal FastAPI app
app = FastAPI(title="Inkling MVP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database (lightweight)
from backend.app.db import initialize_db
initialize_db()

@app.get("/")
def root():
    return {"message": "Inkling backend is running"}

# Load search routers (needed frequently, lightweight)
from backend.app.search import router as search_router
from backend.app.stats import router as stats
app.include_router(search_router, prefix="/api")
app.include_router(stats, prefix="/api")

# Load other routers (can be slow, do in background)
def load_optional_routers():
    """Load heavy routers in background thread."""
    import threading
    
    def load():
        try:
            from backend.app.upload import router as upload_router
            app.include_router(upload_router, prefix="/api")
        except Exception as e:
            print(f"Upload router failed: {e}")
        
        try:
            from backend.app.debug import router as debug_router
            app.include_router(debug_router, prefix="/debug")
        except Exception as e:
            print(f"Debug router failed: {e}")
        
        try:
            from backend.app.files import router as files
            app.include_router(files, prefix="/api")
        except Exception as e:
            print(f"Files router failed: {e}")
    
    thread = threading.Thread(target=load, daemon=True)
    thread.start()

@app.on_event("startup")
def startup():
    load_optional_routers()

if __name__ == "__main__":
    if not port:
        port = 8000
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
    )