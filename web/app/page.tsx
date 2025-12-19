// web/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function SearchHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<any>(null);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    console.log("Searching for:", query);
    // TODO: Connect to your backend search endpoint later
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center space-y-8">
        
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

        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <button onClick={() => router.push('/settings')} className="hover:text-gray-900 transition-colors">
            Settings & Integrations
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="hover:text-gray-900 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}