// web/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/');
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ text: 'Check your email to confirm your account!', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in duration-500">
        
        <h1 className="text-4xl font-serif text-gray-900 tracking-tight">
          {isSignUp ? 'Create an account.' : 'Welcome back.'}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4 max-w-sm mx-auto">
          <div className="relative">
            <input
              type="email"
              required
              // Added text-gray-900 here
              className="w-full h-14 rounded-full border border-gray-200 shadow-sm bg-white px-6 text-lg outline-none focus:ring-2 focus:ring-gray-100 placeholder-gray-400 text-gray-900 transition-all"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="relative">
            <input
              type="password"
              required
              // Added text-gray-900 here
              className="w-full h-14 rounded-full border border-gray-200 shadow-sm bg-white px-6 text-lg outline-none focus:ring-2 focus:ring-gray-100 placeholder-gray-400 text-gray-900 transition-all"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full bg-gray-900 text-white font-medium text-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {message && (
          <div className={`p-4 rounded-xl text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <div className="text-sm text-gray-500">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-gray-900 font-semibold hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}