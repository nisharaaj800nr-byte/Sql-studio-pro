import React, { createContext, useCallback, useContext } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  setThemeMode: () => {},
});


export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // App is locked to dark theme — all screens are designed for dark only.
  const themeMode: ThemeMode = 'dark';
  const setThemeMode = useCallback((_mode: ThemeMode) => {
    // no-op: theme is locked to dark
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
