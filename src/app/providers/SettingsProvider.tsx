'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type CardPalette = 'dynamic' | 'indigo' | 'emerald' | 'purple' | 'blue' | 'rose' | 'amber' | 'slate';
export type AIProvider = 'default' | 'gemini' | 'openai' | 'anthropic' | 'groq';

interface SettingsContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  cardPalette: CardPalette;
  setCardPalette: (palette: CardPalette) => void;
  aiProvider: AIProvider;
  setAiProvider: (provider: AIProvider) => void;
  aiApiKey: string;
  setAiApiKey: (key: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [cardPalette, setCardPaletteState] = useState<CardPalette>('dynamic');
  const [aiProvider, setAiProviderState] = useState<AIProvider>('default');
  const [aiApiKey, setAiApiKeyState] = useState<string>('');
  const [aiModel, setAiModelState] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('qp_theme_mode') as ThemeMode | null;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme);
      }

      const savedPalette = localStorage.getItem('qp_card_palette') as CardPalette | null;
      if (savedPalette && ['dynamic', 'indigo', 'emerald', 'purple', 'blue', 'rose', 'amber', 'slate'].includes(savedPalette)) {
        setCardPaletteState(savedPalette);
        document.documentElement.setAttribute('data-accent', savedPalette);
      } else {
        document.documentElement.setAttribute('data-accent', 'dynamic');
      }

      const savedProvider = localStorage.getItem('qp_ai_provider') as AIProvider | null;
      if (savedProvider && ['default', 'gemini', 'openai', 'anthropic', 'groq'].includes(savedProvider)) {
        setAiProviderState(savedProvider);
      }

      const savedKey = localStorage.getItem('qp_ai_api_key');
      if (savedKey) setAiApiKeyState(savedKey);

      const savedModel = localStorage.getItem('qp_ai_model');
      if (savedModel) setAiModelState(savedModel);
    } catch (e) {
      console.warn('LocalStorage unavailable for settings', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Sync accent palette to DOM
  useEffect(() => {
    if (!isInitialized) return;
    document.documentElement.setAttribute('data-accent', cardPalette);
  }, [cardPalette, isInitialized]);

  // Sync theme mode to DOM
  useEffect(() => {
    if (!isInitialized) return;
    const root = document.documentElement;
    const applyDark = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => applyDark(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyDark(themeMode === 'dark');
    }
  }, [themeMode, isInitialized]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('qp_theme_mode', mode);
    } catch (e) {}
  };

  const setCardPalette = (palette: CardPalette) => {
    setCardPaletteState(palette);
    document.documentElement.setAttribute('data-accent', palette);
    try {
      localStorage.setItem('qp_card_palette', palette);
    } catch (e) {}
  };

  const setAiProvider = (provider: AIProvider) => {
    setAiProviderState(provider);
    try {
      localStorage.setItem('qp_ai_provider', provider);
    } catch (e) {}
  };

  const setAiApiKey = (key: string) => {
    setAiApiKeyState(key);
    try {
      localStorage.setItem('qp_ai_api_key', key);
    } catch (e) {}
  };

  const setAiModel = (model: string) => {
    setAiModelState(model);
    try {
      localStorage.setItem('qp_ai_model', model);
    } catch (e) {}
  };

  const resetSettings = () => {
    setThemeModeState('system');
    setCardPaletteState('dynamic');
    setAiProviderState('default');
    setAiApiKeyState('');
    setAiModelState('');
    try {
      localStorage.removeItem('qp_theme_mode');
      localStorage.removeItem('qp_card_palette');
      localStorage.removeItem('qp_ai_provider');
      localStorage.removeItem('qp_ai_api_key');
      localStorage.removeItem('qp_ai_model');
    } catch (e) {}
  };

  return (
    <SettingsContext.Provider
      value={{
        themeMode,
        setThemeMode,
        cardPalette,
        setCardPalette,
        aiProvider,
        setAiProvider,
        aiApiKey,
        setAiApiKey,
        aiModel,
        setAiModel,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

const defaultSettings: SettingsContextType = {
  themeMode: 'system',
  setThemeMode: () => {},
  cardPalette: 'dynamic',
  setCardPalette: () => {},
  aiProvider: 'default',
  setAiProvider: () => {},
  aiApiKey: '',
  setAiApiKey: () => {},
  aiModel: '',
  setAiModel: () => {},
  resetSettings: () => {},
};

export function useSettings() {
  const context = useContext(SettingsContext);
  return context || defaultSettings;
}
