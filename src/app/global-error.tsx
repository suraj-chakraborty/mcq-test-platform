'use client';

import React from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans antialiased">
        <div className="max-w-md w-full">
          <div className="mb-8 flex justify-center">
            <div className="h-24 w-24 bg-rose-100 rounded-[2rem] flex items-center justify-center shadow-xl shadow-rose-100/50">
              <svg
                className="h-12 w-12 text-rose-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
            Critical Application Error
          </h1>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed">
            A critical error occurred while loading the application. Please try reloading or return to the main portal.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              Reload Application
            </button>
            <a
              href="/"
              className="h-14 text-slate-600 hover:text-slate-900 font-bold hover:bg-slate-100 rounded-2xl transition-all flex items-center justify-center gap-2 no-underline"
            >
              Return to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
