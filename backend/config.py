import os
from supabase import create_client, Client

# Get envs
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("CRITICAL: Supabase credentials are not set in .env")

# Create client, use service role for full privileges in backend
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)