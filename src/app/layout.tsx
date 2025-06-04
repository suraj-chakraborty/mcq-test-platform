'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { Theme } from "@radix-ui/themes";
import { Toaster } from 'sonner';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Theme>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
        </Theme>
      </body>
    </html>
  );
} 