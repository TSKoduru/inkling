# backend/routers/integrations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, supabase
from models.api import GoogleConnectRequest
import requests
import urllib.parse
from datetime import datetime, timedelta
from services.indexer import index_google_drive, index_gmail

router = APIRouter()

@router.get("/google/auth-url")
def get_google_auth_url():
    """
    Generates the URL the frontend should redirect the user to.
    """
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline", 
        "prompt": "consent"       
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.post("/google/connect")
def connect_google_drive(request: GoogleConnectRequest, background_tasks: BackgroundTasks):
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": request.code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    
    response = requests.post(token_url, data=payload)
    tokens = response.json()
    
    if "error" in tokens:
        raise HTTPException(status_code=400, detail=tokens.get("error_description"))
        
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    
    # In a real app, if refresh_token is missing, we might want to fail or notify the user.
    # For now, we proceed.

    data = {
        "user_id": request.user_id,
        "provider": "google_drive",
        "access_token": access_token,
        # Only update refresh_token if we actually got a new one
        **({"refresh_token": refresh_token} if refresh_token else {}),
        "expires_at": (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
    }
    
    try:
        # UPSERT: Matches on the unique constraint (user_id, provider) we just created
        db_res = supabase.table("integrations").upsert(
            data, 
            on_conflict="user_id, provider"
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    background_tasks.add_task(index_google_drive, request.user_id)
    background_tasks.add_task(index_gmail, request.user_id)

    return {"status": "connected", "provider": "google_drive"}

@router.get("/list")
def list_integrations(user_id: str):
    """
    Returns a list of providers this user has connected.
    """
    try:
        response = supabase.table("integrations").select("provider").eq("user_id", user_id).execute()
        # Transform [{'provider': 'google_drive'}] -> ['google_drive']
        connected_providers = [item['provider'] for item in response.data]
        return {"connected": connected_providers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))