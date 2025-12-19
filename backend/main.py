from fastapi import FastAPI
from routers import integrations, search
from fastapi.middleware.cors import CORSMiddleware 

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:3000",  # Frontend
    "http://127.0.0.1:3000",  # Fallback
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ----------------------

# Routers
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])

@app.get("/")
def health_check():
    return {"status": "ok", "version": "0.2.0-clean-slate"}