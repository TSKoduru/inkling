'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load User & Integrations
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      
      try {
        const res = await fetch(`http://localhost:8000/api/v1/integrations/list?user_id=${session.user.id}`);
        const data = await res.json();
        setIntegrations(data.connected || []);
      } catch (err) {
        console.error("Failed to fetch integrations", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // Generic Handler for OAuth Redirects
  const handleConnect = async (provider: string) => {
    try {
      // 1. Get the Auth URL from backend
      // Note: Endpoint changes based on provider
      let endpoint = '';
      if (provider === 'slack') {
        endpoint = 'http://localhost:8000/api/v1/integrations/slack/auth-url';
      } else {
        endpoint = `http://localhost:8000/api/v1/integrations/google/auth-url?service=${provider}`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      
      // 2. Redirect user
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(`Failed to start ${provider} auth`, err);
      alert("Something went wrong connecting to " + provider);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-2xl font-semibold leading-6 text-gray-900 mb-8">
              Data Integrations
            </h3>

            <div className="grid gap-6">
              
              {/* --- GMAIL --- */}
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                    M
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Gmail</h4>
                    <p className="text-sm text-gray-500">Sync emails and threads</p>
                  </div>
                </div>
                {integrations.includes('gmail') ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect('gmail')}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* --- GOOGLE DRIVE --- */}
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    D
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Google Drive</h4>
                    <p className="text-sm text-gray-500">Sync docs and files</p>
                  </div>
                </div>
                {integrations.includes('google_drive') ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect('google_drive')}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* --- SLACK (NEW) --- */}
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                    #
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Slack</h4>
                    <p className="text-sm text-gray-500">Sync public channels</p>
                  </div>
                </div>
                {integrations.includes('slack') ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnect('slack')}
                    className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
                  >
                    Connect
                  </button>
                )}
              </div>

            </div>

            <div className="mt-8 pt-6 border-t flex justify-end">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Back to Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}