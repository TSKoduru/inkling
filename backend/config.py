import os
from supabase import create_client, Client

# Get envs
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("CRITICAL: Supabase credentials are not set in .env")

if not GOOGLE_CLIENT_ID:
    print("WARNING: GOOGLE_CLIENT_ID is missing")

if not SLACK_CLIENT_ID:
    print("WARNING: SLACK_CLIENT_ID is missing")

# Create client, use service role for full privileges in backend
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)