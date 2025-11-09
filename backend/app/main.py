from fastapi import FastAPI
import uvicorn
import socket
import sys
import os
from backend.app.upload import router as upload_router
from backend.app.db import initialize_db
from backend.app.debug import router as debug_router
from backend.app.search import router as search_router
from backend.app.stats import router as stats
from backend.app.files import router as files
from fastapi.middleware.cors import CORSMiddleware

# --- FastAPI Setup (Unchanged) ---
app = FastAPI(title="Inkling MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_db()

app.include_router(upload_router, prefix="/api")
app.include_router(debug_router, prefix="/debug")
app.include_router(search_router, prefix="/api")
app.include_router(stats, prefix="/api")
app.include_router(files, prefix="/api")

@app.get("/")
def root():
    return {"message": "Inkling backend is running"}

# --- Port Utility (Unchanged) ---
def find_free_port():
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port

# --- Main Execution (Updated to use CLI argument) ---
if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Fallback for local development, but print warning
        port_file_path = "backend_port.txt" 
        print(f"WARNING: Port file path not provided as argument. Using default: {port_file_path}")
    else:
        # Use the absolute path provided by the Rust app
        port_file_path = sys.argv[1]

    port = find_free_port()
    
    # Write the port to the file provided via command line argument
    with open(port_file_path, "w") as f:
        f.write(str(port))
        
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=port)