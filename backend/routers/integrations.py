# backend/routers/integrations.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_integrations():
    return {"message": "List of integrations will go here"}

@router.post("/google-drive")
def connect_google_drive():
    return {"message": "Google Drive connection logic will go here"}