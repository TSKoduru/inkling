// web/app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

interface Integration {
  provider: string;
  sync_status: string;
}

export default function SettingsPage() {
  const router = useRouter();
  // Removed useTheme hook
  const [integrations, setIntegrations] = useState<Integration[]>([]);
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
        
        if (data.connected && Array.isArray(data.connected)) {
             setIntegrations(data.connected.map((p: string) => ({ provider: p, sync_status: 'success' })));
        } else {
             setIntegrations(data.integrations || []);
        }
      } catch (err) {
        console.error("Failed to fetch status", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, [router]);

  const handleConnect = async (service: string) => {
    const res = await fetch(`http://localhost:8000/api/v1/integrations/google/auth-url?service=${service}`);
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const getStatusIndicator = (integration: Integration) => {
    if (integration.sync_status === 'syncing') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
           <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span>Indexing...</span>
        </div>
      );
    }
    if (integration.sync_status === 'error') {
       return <span className="text-red-500 text-sm font-medium">Sync Failed</span>;
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
         <span className="h-2 w-2 rounded-full bg-green-500"></span>
         Connected
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
         <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-4 bg-gray-300 rounded-full mb-2"></div>
            <div className="text-gray-400 text-sm">Loading settings...</div>
         </div>
      </div>
    );
  }

  const driveIntegration = integrations.find(i => i.provider === 'google_drive');
  const gmailIntegration = integrations.find(i => i.provider === 'gmail');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
          <button onClick={() => router.push('/')} className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
            ← Back to Search
          </button>
        </div>

        {/* Google Drive Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-900">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.04-1.133 8.027-3.186 2.053-2.04 2.64-5.2 2.64-7.827 0-.773-.067-1.52-.2-2.067h-10.467z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Google Drive</p>
                <p className="text-sm text-gray-500">Syncs Docs and Files</p>
              </div>
            </div>

            {driveIntegration ? (
              getStatusIndicator(driveIntegration)
            ) : (
              <button
                onClick={() => handleConnect('google_drive')}
                className="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all hover:shadow-lg"
              >
                Connect Drive
              </button>
            )}
          </div>
        </div>

        {/* Gmail Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-900">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Gmail</p>
                <p className="text-sm text-gray-500">Syncs Emails</p>
              </div>
            </div>

            {gmailIntegration ? (
              getStatusIndicator(gmailIntegration)
            ) : (
              <button
                onClick={() => handleConnect('gmail')}
                className="px-5 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all hover:shadow-lg"
              >
                Connect Gmail
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}