// web/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

interface SearchResult {
  document_id: string;
  document_name: string;
  chunk_content: string;
  document_url: string;
}

export default function SearchHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Check auth on load
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    };
    checkUser();
  }, [router]);

  // Reset state when query is cleared to return to "Center" view
  useEffect(() => {
    if (query.trim() === '') {
      setHasSearched(false);
      setResults([]);
      setSearching(false);
    }
  }, [query]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !user) return;
    
    setHasSearched(true);
    setSearching(true);
    
    try {
      const res = await fetch('http://localhost:8000/api/v1/search/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          user_id: user.id
        })
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      {/* Dynamic Container Layout:
        - If !hasSearched: 'flex-1 justify-center' centers everything vertically.
        - If hasSearched: 'mt-20' moves the bar to the top.
      */}
      <div 
        className={`w-full max-w-2xl transition-all duration-500 ease-in-out px-4 ${
          hasSearched ? 'mt-20' : 'flex-1 flex flex-col justify-center'
        }`}
      >
        <div className="text-center space-y-8 w-full">
          
          <h1 className="text-4xl font-serif text-gray-900 tracking-tight">
            Where knowledge begins.
          </h1>

          <form onSubmit={handleSearch} className="relative w-full">
            <div className="relative flex items-center w-full h-14 rounded-full border border-gray-200 shadow-sm bg-white hover:shadow-md transition-shadow px-4 focus-within:ring-2 focus-within:ring-gray-100">
              <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-gray-700 text-lg placeholder-gray-400"
                placeholder="Ask anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Settings buttons only show in the initial "Center" state */}
          {!hasSearched && (
            <div className="flex justify-center gap-6 text-sm text-gray-500">
              <button onClick={() => router.push('/settings')} className="hover:text-gray-900 transition-colors">
                Settings & Integrations
              </button>
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hover:text-gray-900 transition-colors">
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Results Section (Appears below the bar) */}
        {hasSearched && (
          <div className="w-full text-left space-y-4 mt-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Mini Nav for Results Mode */}
             <div className="flex justify-between items-center text-xs text-gray-400 mb-6 border-b pb-2">
                <span>Results for "{query}"</span>
                <div className="flex gap-4">
                  <button onClick={() => router.push('/settings')} className="hover:text-gray-900">Settings</button>
                  <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hover:text-gray-900">Sign Out</button>
                </div>
             </div>

            {searching && (
              <div className="text-center text-gray-500 py-10">Searching your library...</div>
            )}
            
            {!searching && results.length > 0 && results.map((result) => (
              <div key={result.document_id} className="p-5 rounded-xl border border-gray-100 hover:bg-gray-50 transition bg-white shadow-sm">
                <a 
                  href={result.document_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  // Dynamically apply the user's selected accent color
                  style={{ color: 'var(--accent-color)' }}
                  className="font-semibold hover:underline flex items-center gap-2 mb-2"
                >
                  {result.document_name}
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {result.chunk_content}
                </p>
              </div>
            ))}

            {!searching && results.length === 0 && (
               <div className="text-center text-gray-400 text-sm mt-10">
                 No results found. Try a different query.
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}