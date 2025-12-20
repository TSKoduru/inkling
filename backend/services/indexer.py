import requests
import base64
import re
import ftfy
from datetime import datetime
from config import supabase
from services.embeddings import generate_embedding
from langchain_text_splitters import RecursiveCharacterTextSplitter
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from datetime import datetime


# --- CONFIGURATION ---
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", " ", ""]
)

# --- HELPER: Global Text Cleaner ---
def clean_text(text: str) -> str:
    """
    1. Fixes encoding artifacts (mojibake) using ftfy.
    2. Normalizes whitespace.
    """
    if not text: 
        return ""
    
    text = ftfy.fix_text(text)
    return text

# --- HELPER: Database Upsert ---
def save_document_and_chunks(user_id, integration_id, doc_meta, full_text):
    print(f"--> Saving: {doc_meta['name']}")
    
    cleaned_text = clean_text(full_text)

    if not cleaned_text:
        print("Skipping empty document.")
        return

    try:
        # Upsert Document
        doc_res = supabase.table("documents").upsert(
            doc_meta, 
            on_conflict="integration_id, external_id"
        ).execute()
        
        doc_id = doc_res.data[0]['id']
    except Exception as e:
        print(f"Error saving document ref: {e}")
        return

    # Create Chunks
    chunks = text_splitter.split_text(cleaned_text)
    print(f"    Split into {len(chunks)} chunks.")

    rows_to_insert = []
    for i, chunk_content in enumerate(chunks):
        vector = generate_embedding(chunk_content)
        
        rows_to_insert.append({
            "document_id": doc_id,
            "content": chunk_content,
            "chunk_index": i,
            "embedding": vector
        })

    # Atomic Replace
    supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
    if rows_to_insert:
        supabase.table("document_chunks").insert(rows_to_insert).execute()


# --- GMAIL INDEXER ---
def extract_email_body(payload):
    text_buffer = []

    def decode(data):
        if not data: return ""
        padding = len(data) % 4
        if padding: data += '=' * (4 - padding)
        try:
            return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
        except:
            return ""

    def traverse(parts):
        for part in parts:
            if 'parts' in part:
                traverse(part['parts'])
            elif part.get('mimeType') == 'text/plain':
                data = part.get('body', {}).get('data')
                if data: text_buffer.append(decode(data))
            elif part.get('mimeType') == 'text/html':
                data = part.get('body', {}).get('data')
                if data:
                    html = decode(data)
                    text_buffer.append(re.sub('<[^<]+?>', ' ', html))

    if 'parts' in payload:
        traverse(payload['parts'])
    else:
        data = payload.get('body', {}).get('data')
        if data: text_buffer.append(decode(data))

    return "\n".join(text_buffer)

def index_gmail(user_id: str):
    print(f"--- Starting Gmail Indexing for {user_id} ---")
    try:
        response = supabase.table("integrations").select("*").eq("user_id", user_id).eq("provider", "gmail").single().execute()
        integration = response.data
        access_token = integration['access_token']
        headers = {"Authorization": f"Bearer {access_token}"}
        
        res = requests.get("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20", headers=headers)
        messages = res.json().get('messages', [])

        for msg_meta in messages:
            msg_res = requests.get(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_meta['id']}", headers=headers).json()
            
            headers_list = msg_res.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers_list if h['name'] == 'Subject'), "No Subject")
            snippet = msg_res.get('snippet', "")
            
            body_text = extract_email_body(msg_res.get('payload', {}))
            
            final_text = f"Subject: {subject}\n\n{body_text}"
            if len(body_text) < 50:
                 final_text += f"\n\nSnippet: {snippet}"

            doc_meta = {
                "user_id": user_id,
                "integration_id": integration['id'],
                "external_id": msg_res['id'],
                "name": subject,
                "mime_type": "text/email",
                "url": f"https://mail.google.com/mail/u/0/#inbox/{msg_res['id']}",
                "last_synced_at": datetime.utcnow().isoformat()
            }

            save_document_and_chunks(user_id, integration['id'], doc_meta, final_text)

        supabase.table("integrations").update({"sync_status": "success"}).eq("id", integration['id']).execute()

    except Exception as e:
        print(f"Gmail Error: {e}")
        supabase.table("integrations").update({"sync_status": "error"}).eq("user_id", user_id).eq("provider", "gmail").execute()


# --- GOOGLE DRIVE INDEXER ---
def index_google_drive(user_id: str):
    print(f"--- Starting Drive Indexing for {user_id} ---")
    try:
        response = supabase.table("integrations").select("*").eq("user_id", user_id).eq("provider", "google_drive").single().execute()
        integration = response.data
        access_token = integration['access_token']
        headers = {"Authorization": f"Bearer {access_token}"}
        
        q = "mimeType='application/vnd.google-apps.document' and trashed=false"
        res = requests.get(f"https://www.googleapis.com/drive/v3/files?q={q}", headers=headers)
        files = res.json().get('files', [])

        for file in files:
            content_url = f"https://www.googleapis.com/drive/v3/files/{file['id']}/export?mimeType=text/plain"
            content_res = requests.get(content_url, headers=headers)
            text_content = content_res.text 

            doc_meta = {
                "user_id": user_id,
                "integration_id": integration['id'],
                "external_id": file['id'],
                "name": file['name'],
                "mime_type": file['mimeType'],
                "url": f"https://docs.google.com/document/d/{file['id']}",
                "last_synced_at": datetime.utcnow().isoformat()
            }
            
            save_document_and_chunks(user_id, integration['id'], doc_meta, text_content)

        supabase.table("integrations").update({"sync_status": "success"}).eq("id", integration['id']).execute()

    except Exception as e:
        print(f"Drive Error: {e}")
        supabase.table("integrations").update({"sync_status": "error"}).eq("user_id", user_id).eq("provider", "google_drive").execute()


# --- SLACK INDEXER ---

# Config: How many seconds of silence triggers a new "document"?
# 300 seconds = 5 minutes
CONVERSATION_GAP_THRESHOLD = 300 

def index_slack(user_id: str):
    print(f"--- Starting Slack Indexing for {user_id} ---")
    try:
        response = supabase.table("integrations").select("*").eq("user_id", user_id).eq("provider", "slack").single().execute()
        integration = response.data
        
        client = WebClient(token=integration['access_token'])
        integration_id = integration['id']

        channels = client.conversations_list(types="public_channel")
        
        for channel in channels["channels"]:
            channel_id = channel["id"]
            channel_name = channel["name"]
            print(f"Processing Channel: {channel_name}")

            # 1. Fetch History & Handle "Not in Channel"
            try:
                history = client.conversations_history(channel=channel_id, limit=100)
            except SlackApiError as e:
                if e.response["error"] == "not_in_channel":
                    try:
                        client.conversations_join(channel=channel_id)
                        history = client.conversations_history(channel=channel_id, limit=100)
                    except Exception:
                        continue # Skip if we still can't join
                else:
                    continue

            # 2. Sort Chronologically (Oldest -> Newest)
            # Slack returns Newest -> Oldest, which is bad for reading context.
            messages = list(reversed(history["messages"]))
            
            if not messages:
                continue

            # 3. Group Messages into "Sessions"
            sessions = []
            current_session = []
            last_ts = 0.0

            for msg in messages:
                if "text" not in msg: continue
                
                current_ts = float(msg["ts"])
                
                # Check time gap (if this isn't the very first message)
                if last_ts > 0 and (current_ts - last_ts) > CONVERSATION_GAP_THRESHOLD:
                    # Gap detected! Save current batch and start new
                    if current_session:
                        sessions.append(current_session)
                    current_session = []

                # Add message to current session
                # Format: [User]: Message
                user_label = msg.get("user", "User") # You could resolve User IDs to names here if you want
                current_session.append(f"[{datetime.fromtimestamp(current_ts).strftime('%H:%M')}] {msg['text']}")
                last_ts = current_ts

            # Don't forget the last session
            if current_session:
                sessions.append(current_session)

            # 4. Save each Session as a separate "Document"
            # This makes search results much cleaner ("Here is a convo from 2pm")
            for i, session_msgs in enumerate(sessions):
                body_text = "\n".join(session_msgs)
                
                # Create a unique time-based title for the search result
                # e.g. "Slack: #dev (Conversation 1)"
                doc_meta = {
                    "user_id": user_id,
                    "integration_id": integration_id,
                    "external_id": f"{channel_id}_{i}", # Unique ID for this specific convo chunk
                    "name": f"Slack: #{channel_name} (Part {i+1})",
                    "mime_type": "application/slack",
                    "url": f"https://slack.com/app_redirect?channel={channel_id}",
                    "last_synced_at": datetime.utcnow().isoformat()
                }
                
                save_document_and_chunks(user_id, integration_id, doc_meta, body_text)

        supabase.table("integrations").update({"sync_status": "success"}).eq("id", integration_id).execute()

    except Exception as e:
        print(f"Slack Error: {e}")
        supabase.table("integrations").update({"sync_status": "error"}).eq("user_id", user_id).eq("provider", "slack").execute()