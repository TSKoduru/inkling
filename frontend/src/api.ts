const API_BASE = "http://localhost:8000/api";

export async function searchQuery(query: string, top_k: number = 10) {
  const params = new URLSearchParams({ query, top_k: top_k.toString() });
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error("Search request failed");
  return res.json();
}

export async function uploadFiles(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch("http://localhost:8000/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return await response.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function openFile(fileName: string) {
  const res = await fetch(`${API_BASE}/open_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: fileName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to open file (${res.status})`);
  }

  return await res.blob();
}

  
