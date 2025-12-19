# backend/routers/integrations.py
from fastapi import APIRouter, HTTPException
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, supabase
from models.api import GoogleConnectRequest
import requests
import urllib.parse
from datetime import datetime, timedelta

router = APIRouter()

router = APIRouter()

@router.get("/google/auth-url")
def get_google_auth_url():
    """
    Generates the URL the frontend should redirect the user to.
    """
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    
    # Need read access to GDrive and GMail
    scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline", # Critical for getting a refresh token
        "prompt": "consent"       # Forces the consent screen every time (good for dev)
    }
    
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.post("/google/connect")
def connect_google_drive(request: GoogleConnectRequest):
    """
    Exchanges the temporary code for a permanent Refresh Token
    and saves it to Supabase.
    """
    # 1. Exchange Code for Tokens
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": request.code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    
    # This acts as the backend talking to Google directly
    response = requests.post(token_url, data=payload)
    tokens = response.json()
    
    if "error" in tokens:
        raise HTTPException(status_code=400, detail=tokens.get("error_description"))
        
    # 2. Extract what we need
    # 'refresh_token' is ONLY returned the first time a user connects.
    # If it's missing, it means they connected before. We should handle that, 
    # but for MVP let's assume it's there or fail.
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    
    if not refresh_token:
        # Note: In production, you might want to tell the user to revoke access and try again
        # to force a new refresh token.
        print("WARNING: No refresh_token returned. User might have already approved app.")

    # 3. Save to Supabase
    # We store this securely so the Worker can use it later
    data = {
        "user_id": request.user_id,
        "provider": "google_drive",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": (datetime.now() + timedelta(seconds=tokens["expires_in"])).isoformat()
    }
    
    # Upsert: If this user already has google_drive connected, update the tokens
    # Note: We really should match on (user_id, provider)
    # For MVP, we'll just insert.
    try:
        db_res = supabase.table("integrations").insert(data).execute()
    except Exception as e:
        # If insert fails, log it
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "connected", "provider": "google_drive"}
