// web/app/integrations/google/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function GoogleCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Finalizing connection...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const service = searchParams.get('state');
    
    if (!code || !service) {
      setStatus('Invalid Request: Missing authentication code.');
      setIsError(true);
      return;
    }

    const exchangeCode = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setStatus('Session expired. Please log in again.');
          setIsError(true);
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
  
        try {
          const res = await fetch('http://localhost:8000/api/v1/integrations/google/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              user_id: user.id,
              service: service 
            })
          });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to exchange token');
        }

        setStatus(`Success! Redirecting...`);
        setTimeout(() => router.push('/settings'), 1000); 
      } catch (err: any) {
        console.error(err);
        setStatus(`Connection Failed: ${err.message}`);
        setIsError(true);
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-6 max-w-md text-center">
        {!isError ? (
            <div className="relative flex items-center justify-center">
                 <svg className="animate-spin h-12 w-12 text-black" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
            </div>
        ) : (
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
        )}

        <div className="space-y-2">
            <h1 className={`text-xl font-semibold ${isError ? 'text-red-600' : 'text-gray-900'}`}>
                {isError ? 'Connection Failed' : 'Connecting...'}
            </h1>
            <p className="text-gray-500 text-sm">
                {status}
            </p>
        </div>

        {isError && (
             <button 
                onClick={() => router.push('/settings')}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
                Return to Settings
            </button>
        )}
      </div>
    </div>
  );
}