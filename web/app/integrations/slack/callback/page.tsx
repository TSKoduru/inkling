'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function SlackCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing Slack connection...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus(`Slack Error: ${error}`);
      return;
    }

    if (!code) {
      setStatus('Error: No code received from Slack.');
      return;
    }

    const connectSlack = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setStatus('Error: You are not logged in.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      try {
        const res = await fetch('http://localhost:8000/api/v1/integrations/slack/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            user_id: session.user.id,
            service: 'slack' 
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || 'Failed to connect Slack');
        }

        setStatus('Success! Redirecting...');
        setTimeout(() => router.push('/settings'), 1000);

      } catch (err: any) {
        console.error(err);
        setStatus(`Connection failed: ${err.message}`);
      }
    };

    connectSlack();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Connecting Slack</h2>
        <div className="text-gray-600 mb-4">{status}</div>
        <div className="animate-pulse flex justify-center">
          <div className="h-2 w-24 bg-purple-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function SlackCallbackPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
      <SlackCallbackContent />
    </Suspense>
  );
}