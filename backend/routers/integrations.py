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
def get_google_auth_url(service: str = "google_drive"):
    """
    Generates the URL the frontend should redirect the user to.
    """
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    
    # DISTINCT SCOPES based on service
    if service == "gmail":
        scope = "https://www.googleapis.com/auth/gmail.readonly"
    else:
        scope = "https://www.googleapis.com/auth/drive.readonly"

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline", 
        "prompt": "consent",
        "state": service # Pass service as state so we know what to do on callback
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.post("/google/connect")
def connect_google_provider(request: GoogleConnectRequest, background_tasks: BackgroundTasks):
    token_url = "https://oauth2.googleapis.com/token"
    
    # We must use the exact same redirect_uri as the auth request
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": request.code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    
    response = requests.post(token_url, data=payload)
    tokens = response.json()
    
    # Enhanced Error Logging
    if "error" in tokens:
        print(f"GOOGLE TOKEN ERROR: {tokens}") # Check your docker/terminal logs if this happens
        raise HTTPException(status_code=400, detail=f"Google Error: {tokens.get('error_description')}")
        
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    
    # Use the service passed from frontend
    provider_name = request.service if hasattr(request, 'service') else 'google_drive'

    data = {
        "user_id": request.user_id,
        "provider": provider_name,
        "access_token": access_token,
        **({"refresh_token": refresh_token} if refresh_token else {}),
        "expires_at": (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
    }
    
    try:
        # UPSERT
        db_res = supabase.table("integrations").upsert(
            data, 
            on_conflict="user_id, provider"
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Trigger specific indexer
    if provider_name == "gmail":
        background_tasks.add_task(index_gmail, request.user_id)
    else:
        background_tasks.add_task(index_google_drive, request.user_id)

    return {"status": "connected", "provider": provider_name}

@router.get("/list")
def list_integrations(user_id: str):
    try:
        response = supabase.table("integrations").select("provider").eq("user_id", user_id).execute()
        connected_providers = [item['provider'] for item in response.data]
        return {"connected": connected_providers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))