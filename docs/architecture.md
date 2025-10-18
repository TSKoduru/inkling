# Inkling — Local Document Search MVP

## Goals

Inkling is a lightweight, fully local document search application designed to let users:

- Upload documents (PDF, DOCX, TXT, Markdown, ZIPs) and store them locally.
- Search across documents quickly with hybrid search (lexical + semantic + RRF rerank).
- Retrieve original files along with relevant snippets.
- Run entirely offline, packaged as a single Windows `.exe` file.
- Optionally keep documents and database encrypted at rest.

Primary MVP focus: fast, local, zero-setup search for end-users, without LLMs or complex agents.

---

## Key Differentiators

- Windows-first: Unlike Paperless-ngx, Inkling is easy to install for users unfamiliar with Linux or Docker.
- Hybrid search: Combines BM25 lexical search, semantic embeddings, and Reciprocal Rank Fusion for top-K results.
- Local encryption: Optional AES file-level encryption for SQLite DB and user files.
- Lightweight and fast: Efficient indexing and retrieval for small-to-medium corpora (<200 MB).
- Multi-format support: Via MarkItDown parsing and custom chunking.
- User-friendly installer: Single `.exe` with minimal dependencies.

---

## User Flow

### 1. Upload

1. User drags and drops files or ZIPs into the frontend UI.
2. Backend parses files via MarkItDown, converting them to Markdown.
3. Text is chunked (paragraph-based, 500–800 tokens per chunk, with 50-token overlap).
4. Chunks are embedded using a local SentenceTransformer model.
5. All chunks, embeddings, and metadata are stored in SQLite, and original files are stored in `.inkling/files/`.

### 2. Search

1. User enters a query in the frontend search box.
2. Backend performs hybrid retrieval:
   - Lexical retrieval using SQLite FTS5/BM25 to get top-N candidate chunks.
   - Semantic retrieval using cosine similarity of query embeddings against candidate chunks.
   - Reciprocal Rank Fusion (RRF) combines lexical and semantic scores to produce a top-K ranked list.
3. Backend returns results to the frontend with:
   - Snippets
   - File names
   - Links to open or download the original files
   - Optional metadata (date, page, etc.)

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|------|
| Backend | FastAPI | Handles uploads, parsing, search API |
| Parsing | MarkItDown | Converts PDFs, DOCX, TXT to Markdown |
| Chunking | Custom Python splitter | Paragraph-based, 500–800 tokens, 50-token overlap |
| Embedding Generation | Local SentenceTransformer model | Fully offline, per chunk |
| Lexical Indexing | SQLite FTS5 / BM25 | Lightweight, embedded, supports ranking |
| Semantic Indexing | SQLite BLOB / in-memory numpy arrays | Optional quantization to save memory |
| Hybrid Search | Python (NumPy / SciPy) | Combines lexical and semantic retrieval with RRF |
| Storage | Filesystem + SQLite | `.inkling/files/` for originals, `chunks` table for chunks/embeddings |
| Encryption | AES file-level (optional) | Encrypts DB at rest, transparent to backend |
| Frontend | Tauri + React | Provides UI, communicates with backend via localhost |
| Packaging | PyInstaller + Tauri bundler | Produces single installer `.exe` for Windows |

---

## Storage Layout
.inkling/
├─ files/ # Original uploaded files
├─ index.sqlite # DB storing chunks, embeddings, metadata
│ ├─ chunks # Chunk text, metadata, embeddings (BLOB)
│ └─ chunks_fts # FTS5 index for lexical search
└─ models/ # Optional local embedding models

---

## Packaging & Installer Flow

1. **Backend (`onedir`)**: PyInstaller bundles Python code + dependencies into a folder with `main.exe`.
2. **Frontend (Tauri)**: React static build is bundled with Tauri; Tauri launches backend executable via localhost.
3. **Installer**: Inno Setup or Tauri bundler copies backend, frontend, models, and SQLite templates to user directory and creates shortcuts.
4. **AES Encryption**: Backend decrypts DB at runtime if enabled.
5. **Result**: Single `.exe` installer that sets up the application, folder structure, and shortcuts for the user.

---

## Next Steps

1. Implement **custom Python chunker** (paragraph-based, token limit, overlap).  
2. Integrate **MarkItDown parsing** and chunking pipeline with backend `/upload` endpoint.  
3. Build **SQLite FTS5 BM25 index** and **embedding storage** in backend.  
4. Implement **hybrid search pipeline** (lexical + semantic + RRF) in `/search` endpoint.  
5. Connect **React frontend** via Tauri to backend APIs (upload + search).  
6. Set up **PyInstaller onedir backend** and Tauri bundling for `.exe`.  
7. Test **first-run setup, AES encryption, and hybrid search performance** on clean Windows environment.  
8. Optional: design **installer script** (Inno Setup) to copy files, create `.inkling/` folder, and shortcuts.  

