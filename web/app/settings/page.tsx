// web/app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function SettingsPage() {
  const router = useRouter();
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIntegrations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`http://localhost:8000/api/v1/integrations/list?user_id=${user.id}`);
        const data = await res.json();
        setConnected(data.connected || []);
      } catch (err) {
        console.error("Failed to fetch status", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, [router]);

  const handleGoogleConnect = async () => {
    const res = await fetch('http://localhost:8000/api/v1/integrations/google/auth-url');
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  if (loading) return <div className="p-10">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button onClick={() => router.push('/')} className="text-sm text-gray-600 hover:underline">
            ← Back to Search
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">Connected Apps</h2>
          
          <div className="flex items-center justify-between py-4 border-b last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">G</div>
              <div>
                <p className="font-medium text-gray-900">Google Drive</p>
                <p className="text-sm text-gray-500">Docs, Sheets, and Gmail</p>
              </div>
            </div>

            {connected.includes('google_drive') ? (
              <div className="flex items-center gap-2">
                 <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                 <span className="text-sm font-medium text-gray-700">Connected</span>
              </div>
            ) : (
              <button
                onClick={handleGoogleConnect}
                className="px-4 py-2 bg-black text-white rounded-md text-sm hover:bg-gray-800 transition-colors"
              >
                Connect
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}