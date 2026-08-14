
import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ThemeWrapper } from './theme-wrapper';
import Script from 'next/script';

export const metadata = {
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
          <Toaster 
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: 'group',
            }}
          />
          <ThemeWrapper>
            {children}
          </ThemeWrapper>
          {process.env.NEXT_PUBLIC_TRACKER_URL && (
            <Script
              src={process.env.NEXT_PUBLIC_TRACKER_URL}
              data-site-id="cmlic6jl90001crhxbvgl0m0j"
              strategy="afterInteractive"
              defer
            />
          )}
      </body>
    </html>
  );
} 