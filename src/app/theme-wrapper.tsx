'use client';

import { Theme } from '@radix-ui/themes';
import { SessionProvider } from 'next-auth/react';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Theme>
      <SessionProvider>
        {children}
      </SessionProvider>
    </Theme>
  );
}
