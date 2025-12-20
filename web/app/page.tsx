// web/app/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
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
  source: string; 
}

const SourceIcon = ({ source }: { source: string }) => {
  const s = source?.toLowerCase() || '';
  
  if (s === 'google_drive' || s === 'drive') {
    return (
      <img 
        src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
        alt="Google Drive" 
        className="w-5 h-5 flex-shrink-0"
      />
    );
  }
  
  if (s === 'gmail' || s === 'mail') {
    return (
      <img 
        src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" 
        alt="Gmail" 
        className="w-5 h-5 flex-shrink-0"
      />
    );
  }

  // Added Slack Case
  if (s === 'slack' || s.includes('slack')) {
    return (
      <img 
        src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" 
        alt="Slack" 
        className="w-5 h-5 flex-shrink-0"
      />
    );
  }

  return (
    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
};

export default function SearchHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (query.trim() === '') {
      setHasSearched(false);
      setResults([]);
      setSearching(false);
      setActiveFilter(null);
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

  const filteredResults = useMemo(() => {
    if (!activeFilter) return results;
    // Updated logic to be more inclusive (e.g. "application/slack" vs "slack")
    return results.filter(r => r.source.toLowerCase().includes(activeFilter));
  }, [results, activeFilter]);

  const FilterButton = ({ label, value }: { label: string, value: string | null }) => (
    <button
      onClick={() => setActiveFilter(value)}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
        activeFilter === value
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  // Helper for empty state text
  const getEmptyStateText = () => {
      if (results.length === 0) return "No results found. Try a different query.";
      
      switch(activeFilter) {
          case 'google_drive': return "No Drive files found in these results.";
          case 'gmail': return "No emails found in these results.";
          case 'slack': return "No Slack messages found in these results.";
          default: return "No results found.";
      }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <div 
        className={`w-full max-w-2xl transition-all duration-500 ease-in-out px-4 ${
          hasSearched ? 'mt-12' : 'flex-1 flex flex-col justify-center'
        }`}
      >
        <div className="text-center w-full">
          
          <h1 className={`font-serif text-gray-900 tracking-tight transition-all duration-500 ${
             hasSearched ? 'text-2xl mb-4' : 'text-4xl mb-8'
          }`}>
            Where knowledge begins.
          </h1>

          <form onSubmit={handleSearch} className="relative w-full z-10">
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

          {/* Filter Pills */}
          <div className={`flex justify-center gap-3 transition-all duration-500 ease-in-out overflow-hidden ${
            hasSearched ? 'max-h-16 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
          }`}>
            <FilterButton label="All" value={null} />
            <FilterButton label="Drive" value="google_drive" />
            <FilterButton label="Gmail" value="gmail" />
            <FilterButton label="Slack" value="slack" />
          </div>

          {!hasSearched && (
            <div className="flex justify-center gap-6 text-sm text-gray-500 mt-6 pt-2">
              <button onClick={() => router.push('/settings')} className="hover:text-gray-900 transition-colors">
                Settings & Integrations
              </button>
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hover:text-gray-900 transition-colors">
                Sign Out
              </button>
            </div>
          )}
        </div>

        {hasSearched && (
          <div className="w-full text-left space-y-4 mt-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
             <div className="flex justify-between items-center text-xs text-gray-400 mb-6 border-b pb-2">
                <span>
                  Results for "{query}" 
                  {activeFilter && <span className="font-semibold ml-1 capitalize">({activeFilter.replace('_', ' ')})</span>}
                </span>
                <div className="flex gap-4">
                  <button onClick={() => router.push('/settings')} className="hover:text-gray-900">Settings</button>
                  <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hover:text-gray-900">Sign Out</button>
                </div>
             </div>

            {searching && (
              <div className="text-center text-gray-500 py-10">Searching...</div>
            )}
            
            {!searching && filteredResults.length > 0 && filteredResults.map((result) => (
              <div key={result.document_id} className="p-5 rounded-xl border border-gray-100 hover:bg-gray-50 transition bg-white shadow-sm">
                <a 
                  href={result.document_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-900 hover:underline flex items-center gap-3 mb-2"
                >
                  <SourceIcon source={result.source} />
                  <span>{result.document_name}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed whitespace-pre-line">
                  {result.chunk_content}
                </p>
              </div>
            ))}

            {!searching && filteredResults.length === 0 && (
               <div className="text-center text-gray-400 text-sm mt-10">
                 {getEmptyStateText()}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}