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

  
