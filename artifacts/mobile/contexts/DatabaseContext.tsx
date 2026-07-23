import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase } from '@/utils/sqliteManager';

const DB_COLORS = [
  '#58A6FF', '#3FB950', '#F85149', '#D2A8FF',
  '#FFA657', '#79C0FF', '#56D364', '#E3B341',
];

export interface DatabaseMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  lastModified: string;
  color: string;
}

interface DatabaseContextType {
  databases: DatabaseMeta[];
  isLoading: boolean;
  activeDbId: string | null;
  setActiveDbId: (id: string | null) => void;
  createDatabase: (name: string, description?: string) => Promise<DatabaseMeta>;
  deleteDatabase: (id: string) => Promise<void>;
  updateDatabase: (id: string, updates: Partial<Pick<DatabaseMeta, 'name' | 'description'>>) => Promise<void>;
  touchDatabase: (id: string) => Promise<void>;
  refreshDatabases: () => Promise<void>;
  getDb: (id: string) => DatabaseMeta | undefined;
}

const STORAGE_KEY = '@sqlstudio_databases_v2';
const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [databases, setDatabases] = useState<DatabaseMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDbId, setActiveDbId] = useState<string | null>(null);

  const loadDatabases = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: DatabaseMeta[] = JSON.parse(stored);
        setDatabases(parsed);
        if (!activeDbId && parsed.length > 0) {
          setActiveDbId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error('[DatabaseContext] Failed to load:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeDbId]);

  useEffect(() => {
    loadDatabases();
  }, []);

  const persist = async (dbs: DatabaseMeta[]) => {
    setDatabases(dbs);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dbs));
  };

  const createDatabase = async (name: string, description = ''): Promise<DatabaseMeta> => {
    const id = `db_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const db: DatabaseMeta = {
      id,
      name: name.trim(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      color: DB_COLORS[databases.length % DB_COLORS.length],
    };
    await initDatabase(id);
    const updated = [...databases, db];
    await persist(updated);
    setActiveDbId(id);
    return db;
  };

  const deleteDatabase = async (id: string) => {
    const updated = databases.filter(d => d.id !== id);
    await persist(updated);
    if (activeDbId === id) {
      setActiveDbId(updated[0]?.id ?? null);
    }
  };

  const updateDatabase = async (
    id: string,
    updates: Partial<Pick<DatabaseMeta, 'name' | 'description'>>
  ) => {
    const updated = databases.map(d =>
      d.id === id ? { ...d, ...updates, lastModified: new Date().toISOString() } : d
    );
    await persist(updated);
  };

  const touchDatabase = async (id: string) => {
    const updated = databases.map(d =>
      d.id === id ? { ...d, lastModified: new Date().toISOString() } : d
    );
    await persist(updated);
  };

  const getDb = (id: string) => databases.find(d => d.id === id);

  return (
    <DatabaseContext.Provider
      value={{
        databases,
        isLoading,
        activeDbId,
        setActiveDbId,
        createDatabase,
        deleteDatabase,
        updateDatabase,
        touchDatabase,
        refreshDatabases: loadDatabases,
        getDb,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabases() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabases must be inside DatabaseProvider');
  return ctx;
}
