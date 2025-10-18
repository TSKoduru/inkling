# backend/tests/test_upload.py
import io
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_upload_text():
    text_data = "This is a short example text document. It should be chunked and embedded."

    # Create a new BytesIO object for each upload attempt
    for field in ["file", "files"]:
        file_obj = io.BytesIO(text_data.encode("utf-8"))

        response = client.post(
            "/api/upload",
            files=[(field, ("example.txt", file_obj, "text/plain"))],
        )

        print(f"\nTried field '{field}'")
        print("Status:", response.status_code)
        try:
            print("JSON:", response.json())
        except Exception:
            print("Response text:", response.text)

if __name__ == "__main__":
    test_upload_text()
