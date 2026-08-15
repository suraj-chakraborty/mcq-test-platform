'use client';

import { Theme } from '@radix-ui/themes';
import { SessionProvider } from 'next-auth/react';
import { SettingsProvider } from '@/app/providers/SettingsProvider';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Theme>
      <SessionProvider>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </SessionProvider>
    </Theme>
  );
}
