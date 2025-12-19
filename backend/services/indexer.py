import requests
import base64
import re
from config import supabase
from datetime import datetime

# Helper updated to support different providers
def get_integration(user_id: str, provider: str = "google_drive"):
    response = supabase.table("integrations") \
        .select("id, access_token") \
        .eq("user_id", user_id) \
        .eq("provider", provider) \
        .single() \
        .execute()
    return response.data

# --- HELPER: Extract Full Email Body ---
def extract_body(payload):
    """
    Recursively extracts ALL text content from the email payload.
    """
    text_buffer = []

    def decode(data):
        if not data: return ""
        # Base64URL decode
        padding = len(data) % 4
        if padding:
            data += '=' * (4 - padding)
        try:
            return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
        except Exception:
            return ""

    def traverse_parts(parts):
        for part in parts:
            mime = part.get('mimeType', '')
            body_data = part.get('body', {}).get('data', '')
            
            # If it's a multipart container, dive deeper
            if 'parts' in part:
                traverse_parts(part['parts'])
            
            # If it's text, decode and append
            elif mime == 'text/plain' and body_data:
                text_buffer.append(decode(body_data))
            elif mime == 'text/html' and body_data:
                # Strip HTML tags
                html_text = decode(body_data)
                clean_text = re.sub('<[^<]+?>', ' ', html_text) # Replace tags with space
                text_buffer.append(clean_text)

    # 1. Start traversal
    if 'parts' in payload:
        traverse_parts(payload['parts'])
    else:
        # Simple message (no parts)
        data = payload.get('body', {}).get('data')
        if data:
            decoded = decode(data)
            if payload.get('mimeType') == 'text/html':
                decoded = re.sub('<[^<]+?>', ' ', decoded)
            text_buffer.append(decoded)

    return "\n".join(text_buffer)

def index_gmail(user_id: str):
    print(f"--- Starting Gmail Indexing for {user_id} ---")
    
    try:
        supabase.table("integrations").update({"sync_status": "syncing"}) \
            .eq("user_id", user_id).eq("provider", "gmail").execute() 

        integration = get_integration(user_id, provider="gmail")
        access_token = integration['access_token']
        integration_id = integration['id']
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Fetch 20 emails
        list_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20"
        res = requests.get(list_url, headers=headers)
        messages = res.json().get('messages', [])

        for msg_meta in messages:
            msg_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_meta['id']}"
            msg_res = requests.get(msg_url, headers=headers).json()
            
            headers_list = msg_res.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers_list if h['name'] == 'Subject'), "No Subject")
            snippet = msg_res.get('snippet', "")
            
            # Extract Body
            body_text = extract_body(msg_res.get('payload', {}))
            
            # Aggressive Fallback:
            # If body is empty OR incredibly short (likely just signatures/headers), append snippet
            if len(body_text.strip()) < 50:
                print(f"DEBUG: Short body for '{subject}'. Appending snippet.")
                body_text += f"\n\n{snippet}"

            print(f"Processing Email: {subject} (Length: {len(body_text)})")

            # Document Data
            doc_data = {
                "user_id": user_id,
                "integration_id": integration_id,
                "external_id": msg_res['id'],
                "name": subject,
                "mime_type": "text/email",
                "url": f"https://mail.google.com/mail/u/0/#inbox/{msg_res['id']}",
                "created_at_external": datetime.fromtimestamp(int(msg_res['internalDate'])/1000).isoformat(),
                "modified_at_external": datetime.fromtimestamp(int(msg_res['internalDate'])/1000).isoformat(),
                "last_synced_at": datetime.utcnow().isoformat()
            }
            
            doc_res = supabase.table("documents").upsert(doc_data, on_conflict="integration_id, external_id").execute()
            doc_id = doc_res.data[0]['id']

            # Chunk Data
            chunk_data = {
                "document_id": doc_id,
                "content": body_text,
                "chunk_index": 0
            }
            
            supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
            supabase.table("document_chunks").insert(chunk_data).execute()

        supabase.table("integrations").update({"sync_status": "success"}).eq("id", integration_id).execute()
        print("--- Gmail Indexing Complete ---")

    except Exception as e:
        print(f"Gmail Indexing Failed: {e}")
        supabase.table("integrations").update({"sync_status": "error"}).eq("user_id", user_id).eq("provider", "gmail").execute()

def index_google_drive(user_id: str):
    # (Same as before - keeping it here so the file is complete if you copy/paste)
    print(f"--- Starting Drive Indexing for {user_id} ---")
    try:
        supabase.table("integrations").update({"sync_status": "syncing"}).eq("user_id", user_id).eq("provider", "google_drive").execute()
        integration = get_integration(user_id, "google_drive")
        access_token = integration['access_token']
        integration_id = integration['id']
        headers = {"Authorization": f"Bearer {access_token}"}
        
        q = "mimeType='application/vnd.google-apps.document' and trashed=false"
        res = requests.get(f"https://www.googleapis.com/drive/v3/files?q={q}&fields=files(id, name, mimeType, webViewLink, createdTime, modifiedTime)", headers=headers)
        files = res.json().get('files', [])

        for file in files:
            print(f"Processing Doc: {file['name']}")
            content_url = f"https://www.googleapis.com/drive/v3/files/{file['id']}/export?mimeType=text/plain"
            content_res = requests.get(content_url, headers=headers)
            text_content = content_res.text

            doc_data = {
                "user_id": user_id,
                "integration_id": integration_id,
                "external_id": file['id'],
                "name": file['name'],
                "mime_type": file['mimeType'],
                "url": file['webViewLink'],
                "created_at_external": file['createdTime'],
                "modified_at_external": file['modifiedTime'],
                "last_synced_at": datetime.utcnow().isoformat()
            }
            doc_res = supabase.table("documents").upsert(doc_data, on_conflict="integration_id, external_id").execute()
            doc_id = doc_res.data[0]['id']

            chunk_data = {"document_id": doc_id, "content": text_content, "chunk_index": 0}
            supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
            supabase.table("document_chunks").insert(chunk_data).execute()

        supabase.table("integrations").update({"sync_status": "success"}).eq("id", integration_id).execute()
    except Exception as e:
        print(f"Drive Indexing Failed: {e}")
        supabase.table("integrations").update({"sync_status": "error"}).eq("user_id", user_id).eq("provider", "google_drive").execute()