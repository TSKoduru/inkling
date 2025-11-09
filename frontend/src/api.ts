// Cache the backend port after the first lookup
// NOTE: This will be cleared when calling startBackend to ensure fresh connection
let backendPort: number | null = null;

// Check if we're running in Tauri more robustly
function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  const w = window as any;
  return (
    '__TAURI__' in w ||
    w.__TAURI_INTERNALS__ !== undefined ||
    (typeof w.__TAURI__ !== 'undefined' && w.__TAURI__ !== null)
  );
}

/**
 * Safe invoke wrapper that works in both Tauri and browser
 */
async function tauriInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error("Not running in Tauri environment");
  }
  
  const tauri = (window as any).__TAURI_INTERNALS__;
  if (!tauri?.invoke) {
    // Try alternate path
    const tauri2 = (window as any).__TAURI__;
    if (tauri2?.invoke) {
      return await tauri2.invoke(cmd, args);
    }
    throw new Error("Tauri invoke not available");
  }
  
  return await tauri.invoke(cmd, args);
}

/**
 * Gets the FastAPI backend port from the Tauri main process.
 * The Rust backend launches the FastAPI server and reads the port from stdout.
 * Falls back to a default port for browser development.
 */
async function getBackendPort(): Promise<number> {
  
  if (backendPort) {
    return backendPort;
  }

  // If running in browser (not Tauri), use default port for development
  if (!isTauriEnvironment()) {
    console.warn("Running in browser mode - using default port 8000");
    backendPort = 8000;
    return backendPort;
  }

  try {
    backendPort = await tauriInvoke<number>("get_backend_port");
    
    if (!backendPort) throw new Error("Backend port not found");
  } catch (err) {
    console.error("Failed to get backend port from Tauri:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));
    throw new Error("Backend not available");
  }

  return backendPort;
}

/**
 * Helper to construct the base API URL dynamically.
 */
async function getApiBase(): Promise<string> {
  const port = await getBackendPort();
  return `http://127.0.0.1:${port}/api`;
}

/**
 * Search endpoint
 */
export async function searchQuery(query: string, top_k = 10) {
  const base = await getApiBase();
  const res = await fetch(`${base}/search?query=${encodeURIComponent(query)}&top_k=${top_k}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

/**
 * Upload files endpoint
 */
export async function uploadFiles(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const base = await getApiBase();
  const res = await fetch(`${base}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch app stats (like file count, etc.)
 */
export async function getStats() {
  const base = await getApiBase();
  const res = await fetch(`${base}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}

/**
 * Request backend to open a file (e.g., in system viewer)
 */
export async function openFile(fileName: string) {
  const base = await getApiBase();
  const res = await fetch(`${base}/open_file`, {
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

/**
 * Helper to generate thumbnail URL for given file
 */
export async function getThumbnailUrl(fileName: string): Promise<string> {
  const base = await getApiBase();
  return `${base}/thumbnail/${encodeURIComponent(fileName)}`;
}

/**
 * Start the backend (for Tauri app)
 */
export async function startBackend() {
  if (!isTauriEnvironment()) {
    console.log("Not in Tauri, skipping backend start");
    return;
  }
  
  console.log("Invoking start_backend command...");
  return await tauriInvoke("start_backend");
}