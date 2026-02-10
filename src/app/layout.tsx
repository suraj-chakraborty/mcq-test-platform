
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
      </body>
    </html>
  );
} 