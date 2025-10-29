import React, { useState, useEffect, useRef } from 'react';
import { Search, File, FileText, Archive, Settings, Upload, X, ChevronRight, Filter, Calendar, Tag, Folder } from 'lucide-react';
import { searchQuery, uploadFiles, getStats } from "./api";

const ACCENT_COLORS = {
  purple: { light: '#a78bfa', dark: '#7c3aed', darker: '#5b21b6' },
  blue: { light: '#60a5fa', dark: '#2563eb', darker: '#1e40af' },
  green: { light: '#4ade80', dark: '#16a34a', darker: '#15803d' },
  orange: { light: '#fb923c', dark: '#ea580c', darker: '#c2410c' },
  pink: { light: '#f472b6', dark: '#db2777', darker: '#9f1239' },
  teal: { light: '#2dd4bf', dark: '#0d9488', darker: '#115e59' },
};

export default function InklingUI() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedAccent, setSelectedAccent] = useState('purple');
  const [showSettings, setShowSettings] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedTag, setSelectedTag] = useState('all');
  const [totalDocuments, setTotalDocuments] = useState(0);
  const fileInputRef = useRef(null);

  const accent = ACCENT_COLORS[selectedAccent];

  const getSortedResults = () => {
    if (results.length === 0) return [];
    let sorted = [...results];

    if (selectedTag !== 'all') {
      sorted = sorted.filter(r => {
        const ext = r.file_name.split('.').pop().toLowerCase();
        if (selectedTag === 'pdf') return ext === 'pdf';
        if (selectedTag === 'text') return ext === 'txt' || ext === 'md';
        if (selectedTag === 'archive') return ext === 'zip' || ext === 'rar';
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
          return dateB - dateA;
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
      console.error("Search error:", err);
      alert("Search failed. Is the backend running on port 8000?");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setIsUploading(true);

    try {
      const res = await uploadFiles(filesArray);
      if (res?.message) {
        alert(res.message);
      } else {
        alert("Files uploaded successfully!");
      }
    
      const updatedStats = await getStats();
      if (updatedStats.total_documents !== undefined) {
        setTotalDocuments(updatedStats.total_documents);
      }
    
    } catch {
      alert("Upload failed. Please check your backend connection.");
    } finally {
      setIsUploading(false);
    }
    
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'zip': return <Archive className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  const getFilePreview = (result) => {
    if (result.thumbnail_url) {
      return (
        <img 
          src={result.thumbnail_url} 
          alt={`Preview of ${result.file_name}`}
          className="w-full h-full object-cover rounded-lg"
        />
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-center">
        {getFileIcon(result.file_name)}
      </div>
    );
  };

  const truncateText = (text, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  
  useEffect(() => {
    async function fetchStats() {
      try {
        const stats = await getStats();
        if (stats.total_documents !== undefined) {
          setTotalDocuments(stats.total_documents);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    }
    fetchStats();
  }, []);
  
  useEffect(() => {
    if (!query.trim() && results.length > 0) {
      setResults([]);
    }
  }, [query, results.length]); 

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: accent.dark }}
            >
              I
            </div>
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
              accept=".pdf,.txt,.zip,.md"
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
                    {totalDocuments || '—'}
                  </p>
                  <p className="text-xs text-zinc-500">Total documents</p>
                </div>
                <div className="pt-3 border-t border-zinc-800">
                  <p className="text-2xl font-semibold" style={{ color: accent.light }}>
                    {results.length > 0 ? results.length : '—'}
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
                  { value: 'archive', label: 'Archives', icon: Archive }
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
                          ringColor: selectedAccent === name ? color.light : 'transparent'
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
                  <div
                    key={result.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all group cursor-pointer"
                  >
                    <div className="flex gap-4">
                      <div 
                        className="w-24 h-32 rounded-lg flex-shrink-0 overflow-hidden border border-zinc-800"
                        style={{ backgroundColor: `${accent.dark}15` }}
                      >
                        {getFilePreview(result)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-medium truncate text-zinc-200">
                            {result.file_name}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button 
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 hover:bg-zinc-700"
                              title="Open file"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-sm leading-relaxed text-zinc-400 break-words">
                          {truncateText(result.chunk_text, 180)}
                        </p>
                      </div>
                    </div>
                  </div>
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

        {isUploading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center p-8 rounded-xl bg-zinc-900 shadow-2xl border border-zinc-700">
              <div 
                className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mb-4"
                style={{ borderColor: `${accent.light} transparent ${accent.light} ${accent.light}` }}
              />
              <p className="text-lg font-medium text-zinc-200">Processing Upload...</p>
              <p className="text-sm text-zinc-400 mt-1">This may take a moment for large files.</p>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}