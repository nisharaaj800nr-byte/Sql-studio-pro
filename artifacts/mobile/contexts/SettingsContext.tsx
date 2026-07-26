import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  // Editor
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoComplete: boolean;
  autoFormatOnPaste: boolean;
  // Query
  rowLimit: number;
  queryTimeoutMs: number;
  // Export
  defaultExportFormat: 'csv' | 'json' | 'sql';
  includeHeadersInCSV: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  autoComplete: true,
  autoFormatOnPaste: true,
  rowLimit: 100,
  queryTimeoutMs: 30000,
  defaultExportFormat: 'csv',
  includeHeadersInCSV: true,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => Promise<void>;
}

const STORAGE_KEY = '@sqlstudio_settings_v1';

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  resetSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch {}
      }
    });
  }, []);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
