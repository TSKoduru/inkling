import React, { useState, useEffect, useRef } from 'react';
import { Search, File, FileText, Settings, Upload, ChevronRight, Filter, Tag, Folder } from 'lucide-react';
import { searchQuery, uploadFiles, getStats, openFile, getThumbnailUrl, startBackend } from "./api";

const ACCENT_COLORS = {
  purple: { light: '#a78bfa', dark: '#7c3aed', darker: '#5b21b6' },
  blue: { light: '#60a5fa', dark: '#2563eb', darker: '#1e40af' },
  green: { light: '#4ade80', dark: '#16a34a', darker: '#15803d' },
  orange: { light: '#fb923c', dark: '#ea580c', darker: '#c2410c' },
  pink: { light: '#f472b6', dark: '#db2777', darker: '#9f1239' },
  teal: { light: '#2dd4bf', dark: '#0d9488', darker: '#115e59' },
};

// Separate component for file preview to avoid hook violations
function FilePreviewCard({ result, accent, onOpenFile }: { result: any; accent: any; onOpenFile: (name: string) => void }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const url = await getThumbnailUrl(result.file_name);
        if (mounted) setThumbnailUrl(url);
      } catch (err) {
        console.error("Failed to load thumbnail:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [result.file_name]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all group cursor-pointer">
      <div className="flex gap-4">
        <div 
          className="w-24 h-32 rounded-lg flex-shrink-0 overflow-hidden border border-zinc-800"
          style={{ backgroundColor: `${accent.dark}15` }}
        >
          {!thumbnailUrl ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg">
              <div className="text-sm text-zinc-500">Loading...</div>
            </div>
          ) : (
            <img
              src={thumbnailUrl}
              alt={`Preview of ${result.file_name}`}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const container = target.parentElement;
                if (container) {
                  container.innerHTML = '';
                  container.className = 'w-full h-full flex items-center justify-center text-zinc-400';
                }
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-medium truncate text-zinc-200">
              {result.file_name}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 hover:bg-zinc-700 cursor-pointer" 
                title="Open file"
                onClick={() => onOpenFile(result.file_name)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InklingUI() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedAccent, setSelectedAccent] = useState('purple');
  const [showSettings, setShowSettings] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedTag, setSelectedTag] = useState('all');
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [notifications, setNotifications] = useState<{id: number, message: string, type: 'success' | 'error', fading?: boolean}[]>([]);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [largeFileWarning, setLargeFileWarning] = useState<{show: boolean, files: File[], totalSize: number}>({show: false, files: [], totalSize: 0});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_COLORS[selectedAccent as keyof typeof ACCENT_COLORS];

  // Notification helpers
  const showNotification = (message: string, type: 'success' | 'error' = 'success', duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
  
    setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, fading: true } : n));
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 500);
    }, duration);
  };

  const getSortedResults = () => {
    if (results.length === 0) return [];
    let sorted = [...results];

    if (selectedTag !== 'all') {
      sorted = sorted.filter(r => {
        const ext = r.file_name.split('.').pop().toLowerCase();
        if (selectedTag === 'pdf') return ext === 'pdf';
        if (selectedTag === 'text') return ext === 'txt' || ext === 'md';
        return true;
      });
    }

    switch (sortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => a.file_name.localeCompare(b.file_name));
        break;
      case 'date':
        sorted.sort((a, b) => {
          const dateA = new Date(a.date_added || 0);
          const dateB = new Date(b.date_added || 0);
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        break;
      case 'relevance':
      default:
        break;
    }

    return sorted;
  };

  const sortedResults = getSortedResults();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);

    try {
      const data = await searchQuery(query, 10);
      setResults(data);
    } catch (err) {
      showNotification("Search failed.", 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesArray = e.target.files ? Array.from(e.target.files) : [];
    if (filesArray.length === 0) {
      return;
    }
  
    // Check total file size
    const totalSize = filesArray.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    
    // Warn if files are large (>5MB total)
    if (totalSizeMB > 5) {
      setLargeFileWarning({ show: true, files: filesArray, totalSize: totalSizeMB });
      e.target.value = "";
      return;
    }
    
    // Otherwise proceed with upload
    await performUpload(filesArray);
    e.target.value = "";
  };

  const performUpload = async (filesArray: File[]) => {
    setIsUploading(true);
    setLargeFileWarning({ show: false, files: [], totalSize: 0 });
    
    try {
      const res = await uploadFiles(filesArray);
      if (res?.message) {
        showNotification(res.message, "success");
      }
      const updatedStats = await getStats();
      if (updatedStats.total_documents !== undefined) {
        setTotalDocuments(updatedStats.total_documents);
      }
    } catch (err) {
      showNotification("Upload failed. Please check your backend.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  async function handleOpenFile(fileName: string) {
    try {
      const blob = await openFile(fileName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`Downloaded ${fileName}`, 'success');
    } catch (err) {
      showNotification(`Failed to download ${fileName}`, 'error');
    }
  }

  // Fetch initial stats (after backend is connected)
  useEffect(() => {
    async function fetchStats() {
      try {
        const stats = await getStats();
        if (stats.total_documents !== undefined) {
          setTotalDocuments(stats.total_documents);
        }
      } catch (err) {
        console.warn('Stats fetch failed:', err);
      }
    }

    // Only fetch stats after app is done loading (backend is ready)
    if (!isAppLoading) {
      fetchStats();
    }
  }, [isAppLoading]);

  // Initialize backend on app load
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && (
      '__TAURI__' in window || 
      (window as any).__TAURI_INTERNALS__ !== undefined ||
      typeof (window as any).__TAURI__ !== 'undefined'
    );
    
    if (!isTauri) {
      setIsAppLoading(false);
      return;
    }

    let interval: ReturnType<typeof setInterval>;
    let backendStarted = false;
  
    async function initializeBackend() {
      if (!backendStarted) {
        try {
          await startBackend();
          backendStarted = true;
        } catch (err) {
          console.error("Failed to start backend:", err);
          showNotification("Failed to start backend. Check console.", 'error');
          setIsAppLoading(false);
          return;
        }
      }

      async function checkBackend() {
        try {
          // Wait for backend to actually respond
          await getStats();
          console.log("Backend is ready!");
          setIsAppLoading(false);
          clearInterval(interval);
        } catch (err) {
          console.warn("Backend not ready yet, retrying...", err);
        }
      }
    
      interval = setInterval(checkBackend, 1000);
      checkBackend();
    }

    initializeBackend();
  
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!query.trim() && results.length > 0) {
      setResults([]);
    }
  }, [query, results.length]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Loading screen */}
      {isAppLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mb-4"
            style={{ borderColor: `${accent.light} transparent ${accent.light} ${accent.light}` }}
          />
          <p className="text-lg font-medium">Starting up...</p>
          <p className="text-sm text-zinc-400 mt-2">Connecting to backend...</p>
        </div>
      )}

      {/* Large file warning modal */}
      {largeFileWarning.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center p-8 rounded-xl bg-zinc-900 shadow-2xl border border-zinc-700 max-w-md">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: `${accent.dark}20` }}
            >
              <Upload className="w-6 h-6" style={{ color: accent.light }} />
            </div>
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">Large Upload Detected</h2>
            <p className="text-sm text-zinc-400 text-center mb-4">
              You're uploading {largeFileWarning.totalSize.toFixed(1)} MB of files. 
              Processing large files can take several minutes. The app will be unresponsive during this time.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  setLargeFileWarning({ show: false, files: [], totalSize: 0 });
                  fileInputRef.current?.click();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => performUpload(largeFileWarning.files)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-white"
                style={{ backgroundColor: accent.dark }}
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload processing modal */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center p-8 rounded-xl bg-zinc-900 shadow-2xl border border-zinc-700">
            <div 
              className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-4"
              style={{ borderColor: `${accent.light} transparent ${accent.light} ${accent.light}` }}
            />
            <p className="text-lg font-medium text-zinc-200">Processing Files...</p>
            <p className="text-sm text-zinc-400 mt-2">This may take several minutes for large files.</p>
            <p className="text-xs text-zinc-500 mt-1">Please wait and do not close the app.</p>
          </div>
        </div>
      )}

      {/* Notifications - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white transform transition-all duration-500 ${
              n.fading ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
            }`}
            style={{
              backgroundColor: accent.dark,
              border: `2px solid ${n.type === 'success' ? '#16a34a' : '#dc2626'}`,
            }}
          >
            {n.message}
          </div>
        ))}
      </div>

      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setQuery('')}>
            <img 
              src={`/icons/inkling-${selectedAccent}.png`}
              alt="Inkling"
              className="w-8 h-8"
            />
            <h1 className="text-xl font-semibold">Inkling</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.txt,.zip,.md,.html,.png,.jpg"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-3 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Quick Stats</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-semibold" style={{ color: accent.light }}>
                    {totalDocuments || '–'}
                  </p>
                  <p className="text-xs text-zinc-500">Total documents</p>
                </div>
                <div className="pt-3 border-t border-zinc-800">
                  <p className="text-2xl font-semibold" style={{ color: accent.light }}>
                    {results.length > 0 ? results.length : '–'}
                  </p>
                  <p className="text-xs text-zinc-500">Results found</p>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-400">Sort By</h3>
              </div>
              <div className="space-y-2">
                {[
                  { value: 'relevance', label: 'Relevance' },
                  { value: 'alphabetical', label: 'Alphabetical' },
                  { value: 'date', label: 'Date Added' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === option.value
                        ? 'text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                    style={{
                      backgroundColor: sortBy === option.value ? `${accent.dark}30` : undefined,
                      borderLeft: sortBy === option.value ? `3px solid ${accent.dark}` : '3px solid transparent'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-400">File Types</h3>
              </div>
              <div className="space-y-2">
                {[
                  { value: 'all', label: 'All Files', icon: Folder },
                  { value: 'pdf', label: 'PDFs', icon: FileText },
                  { value: 'text', label: 'Text Files', icon: File },
                ].map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedTag(option.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        selectedTag === option.value
                          ? 'text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                      style={{
                        backgroundColor: selectedTag === option.value ? `${accent.dark}30` : undefined,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </div>
                <ChevronRight 
                  className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`}
                />
              </button>

              {showSettings && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-3">Accent Color</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(ACCENT_COLORS).map(([name, color]) => (
                      <button
                        key={name}
                        onClick={() => setSelectedAccent(name)}
                        className={`w-full aspect-square rounded-lg transition-all ${
                          selectedAccent === name 
                            ? 'ring-2 ring-offset-2 ring-offset-zinc-900' 
                            : 'hover:scale-110'
                        }`}
                        style={{ 
                          backgroundColor: color.dark,
                        }}
                        title={name.charAt(0).toUpperCase() + name.slice(1)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Search Tips</h3>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li>• Use quotes for exact phrases</li>
                <li>• Try related keywords</li>
                <li>• Be specific for best results</li>
                <li>• Filter by file type for focus</li>
              </ul>
            </div>
          </aside>

          <div className="col-span-9">
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none z-10" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search your knowledge base..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pr-4 py-4 text-lg focus:outline-none focus:border-opacity-100 transition-all"
                  style={{ 
                    paddingLeft: '3.5rem',
                    borderColor: query ? accent.dark : undefined,
                    boxShadow: query ? `0 0 0 1px ${accent.dark}20` : undefined
                  }}
                />
              </div>

              {query && !isSearching && results.length === 0 && (
                <p className="mt-3 text-sm text-zinc-500 px-1">
                  Press Enter to search or continue typing...
                </p>
              )}
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center py-20">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${accent.dark} transparent ${accent.dark} ${accent.dark}` }}
                />
              </div>
            ) : sortedResults.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4 px-1">
                  <p className="text-sm text-zinc-500">
                    Found {sortedResults.length} results
                  </p>
                  <p className="text-xs text-zinc-600">
                    Sorted by {sortBy === 'alphabetical' ? 'name' : sortBy}
                  </p>
                </div>

                {sortedResults.map((result) => (
                  <FilePreviewCard 
                    key={result.id} 
                    result={result} 
                    accent={accent}
                    onOpenFile={handleOpenFile}
                  />
                ))}
              </div>
            ) : query ? (
              <div className="text-center py-20">
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${accent.dark}20` }}
                >
                  <Search className="w-8 h-8" style={{ color: accent.light }} />
                </div>
                <h3 className="text-lg font-medium text-zinc-300 mb-2">No results found</h3>
                <p className="text-zinc-500">Try searching with different keywords</p>
              </div>
            ) : (
              <div className="text-center py-20">
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${accent.dark}20` }}
                >
                  <FileText className="w-8 h-8" style={{ color: accent.light }} />
                </div>
                <h3 className="text-lg font-medium text-zinc-300 mb-2">
                  Your local knowledge base
                </h3>
                <p className="text-zinc-500 mb-6">
                  Upload files to get started or search existing content
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
                  style={{ 
                    backgroundColor: accent.dark,
                    color: 'white'
                  }}
                >
                  Upload Your First Files
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t mt-auto border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-xs text-center text-zinc-600">
            All data stays local on your machine • Powered by semantic search
          </p>
        </div>
      </footer>
    </div>
  );
}