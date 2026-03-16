
import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ThemeWrapper } from './theme-wrapper';
import Script from 'next/script';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
         <ThemeWrapper>
          {children}
          <Toaster />
        </ThemeWrapper>
          <Script
            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1/"}track.js`}
            data-site-id="cmlic6jl90001crhxbvgl0m0j"
            strategy="afterInteractive"
            defer
            />
      </body>
    </html>
  );
} 