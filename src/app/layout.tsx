
import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ThemeWrapper } from './theme-wrapper';

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