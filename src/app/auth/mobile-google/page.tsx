'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function MobileGoogleAuthBridge() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const scheme = searchParams.get('scheme') || 'mcqtestplatformmobile';
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      // Trigger Google OAuth sign-in with return to this page
      signIn('google', { callbackUrl: window.location.href });
    } else if (status === 'authenticated') {
      // Fetch mobile JWT tokens using the session cookie
      fetch('/api/mobile/v1/auth/google/token')
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to generate mobile tokens');
          }
          return res.json();
        })
        .then((data) => {
          const appDeepLink = `${scheme}://auth/callback?accessToken=${encodeURIComponent(
            data.accessToken
          )}&refreshToken=${encodeURIComponent(data.refreshToken)}&user=${encodeURIComponent(
            JSON.stringify(data.user)
          )}`;
          setRedirectUrl(appDeepLink);
          // Redirect into the mobile app
          window.location.href = appDeepLink;
        })
        .catch((err) => {
          console.error('Error bridging mobile auth:', err);
          setError(err.message || 'Authentication failed');
        });
    }
  }, [status, scheme]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-2">Google Authentication</h1>

        {error ? (
          <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
            <p className="font-semibold">Authentication Error</p>
            <p className="mt-1 text-xs">{error}</p>
            <button
              onClick={() => signIn('google', { callbackUrl: window.location.href })}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">
                {status === 'loading'
                  ? 'Connecting to Google...'
                  : status === 'unauthenticated'
                  ? 'Redirecting to Google Sign-In...'
                  : 'Preparing your mobile session...'}
              </p>
            </div>

            {redirectUrl && (
              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-3">
                  If the app did not open automatically, tap below:
                </p>
                <a
                  href={redirectUrl}
                  className="inline-block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Return to App
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
