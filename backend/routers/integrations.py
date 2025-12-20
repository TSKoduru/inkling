# backend/routers/integrations.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from models.api import GoogleConnectRequest
import requests
import urllib.parse
from datetime import datetime, timedelta
from services.indexer import index_google_drive, index_gmail
from config import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, 
    SLACK_CLIENT_ID, SLACK_CLIENT_SECRET,
    supabase
)

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

@router.get("/slack/auth-url")
def get_slack_auth_url():
    
    print(f"DEBUG: Slack Client ID is: '{SLACK_CLIENT_ID}'")

    if not SLACK_CLIENT_ID:
        return {"error": "Missing Slack Client ID"}

    base = "https://slack.com/oauth/v2/authorize"
    scope = "channels:history,channels:read,users:read"
    return {"url": f"{base}?client_id={SLACK_CLIENT_ID}&scope={scope}&user_scope="}
@router.post("/slack/connect")
def connect_slack(request: GoogleConnectRequest, background_tasks: BackgroundTasks):
    # Reuse GoogleConnectRequest since it just needs 'code' and 'user_id'
    
    # Exchange code for token
    res = requests.post("https://slack.com/api/oauth.v2.access", data={
        "client_id": SLACK_CLIENT_ID,
        "client_secret": SLACK_CLIENT_SECRET,
        "code": request.code
    })
    data = res.json()
    
    if not data.get("ok"):
        raise HTTPException(400, f"Slack Error: {data.get('error')}")

    access_token = data["access_token"]
    team_name = data["team"]["name"]
    
    # Save to DB
    db_data = {
        "user_id": request.user_id,
        "provider": "slack",
        "access_token": access_token,
        "metadata": {"team_name": team_name},
        "expires_at": None # Slack bot tokens don't expire by default
    }
    
    supabase.table("integrations").upsert(db_data, on_conflict="user_id, provider").execute()
    
    # Trigger Indexing
    from services.indexer import index_slack
    background_tasks.add_task(index_slack, request.user_id)

    return {"status": "connected", "provider": "slack"}

@router.get("/list")
def list_integrations(user_id: str):
    try:
        response = supabase.table("integrations").select("provider").eq("user_id", user_id).execute()
        connected_providers = [item['provider'] for item in response.data]
        return {"connected": connected_providers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))