// web/app/integrations/google/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// We initialize Supabase client-side just to get the current User ID
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function GoogleCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const code = searchParams.get('code');
    
    if (!code) {
      setStatus('Error: No code found in URL');
      return;
    }

    const exchangeCode = async () => {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setStatus('Error: You must be logged in to connect Google Drive.');
          // Optional: Redirect them to login if session is lost
          router.push('/login'); 
          return;
        }
  
        try {
          // 2. Send code to Python Backend
          const res = await fetch('http://localhost:8000/api/v1/integrations/google/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              user_id: user.id // Now using the REAL ID
            })
          });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to exchange token');
        }

        // 3. Success! Redirect to home/dashboard
        setStatus('Success! Redirecting...');
        setTimeout(() => router.push('/'), 1500); // Wait 1.5s so they see the success msg
      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="p-8 border rounded shadow-lg">
        <h1 className="text-xl font-bold mb-4">Connecting Google Drive...</h1>
        <p className={status.startsWith('Error') ? 'text-red-500' : 'text-green-600'}>
          {status}
        </p>
      </div>
    </div>
  );
}