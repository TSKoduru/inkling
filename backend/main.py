from fastapi import FastAPI
from routers import search, integrations

app = FastAPI(title="Inkling Backend")

# Register the endpoints (routers)
# We prefix them so the URL looks like /api/v1/search
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])

@app.get("/")
def health_check():
    return {"status": "ok", "version": "0.2.0-clean-slate"}