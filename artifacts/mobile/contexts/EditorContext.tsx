import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { executeQuery as execSql, QueryResult, DatabaseCorruptError } from '@/utils/sqliteManager';
import { formatSQLiteError } from '@/utils/sqlDiagnostics';
import { useSettings } from '@/contexts/SettingsContext';

export interface QueryHistoryEntry {
  id: string;
  sql: string;
  databaseId: string;
  databaseName: string;
  timestamp: string;
  success: boolean;
  rowCount: number;
  executionTime: number;
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  databaseId?: string;
  createdAt: string;
}

interface EditorContextType {
  currentSql: string;
  setCurrentSql: (sql: string) => void;
  queryResult: QueryResult | null;
  isExecuting: boolean;
  lastError: string | null;
  executeQuery: (dbId: string, dbName: string, sql: string) => Promise<void>;
  queryHistory: QueryHistoryEntry[];
  clearHistory: () => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  savedQueries: SavedQuery[];
  saveQuery: (name: string, sql: string, dbId?: string) => Promise<SavedQuery>;
  deleteSavedQuery: (id: string) => Promise<void>;
  totalQueriesRun: number;
}

const HISTORY_KEY = '@sqlstudio_history_v2';
const SAVED_KEY = '@sqlstudio_saved_v2';
const STATS_KEY = '@sqlstudio_stats_v1';

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  const [currentSql, setCurrentSql] = useState(
    "-- Welcome to SQL Studio Pro\nSELECT * FROM sqlite_master WHERE type = 'table';"
  );
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [totalQueriesRun, setTotalQueriesRun] = useState(0);
  // A timeout only stops waiting for the result; expo-sqlite cannot cancel an
  // already-running native statement. Keep a lock until that promise settles
  // so a second run cannot overlap the first one and destabilize the database.
  const activeExecutionRef = useRef<Promise<QueryResult> | null>(null);

  const historyRef = useRef(queryHistory);
  historyRef.current = queryHistory;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(HISTORY_KEY),
      AsyncStorage.getItem(SAVED_KEY),
      AsyncStorage.getItem(STATS_KEY),
    ]).then(([h, s, st]) => {
      if (h) setQueryHistory(JSON.parse(h));
      if (s) setSavedQueries(JSON.parse(s));
      if (st) {
        const stats = JSON.parse(st);
        setTotalQueriesRun(stats.totalQueriesRun ?? 0);
      }
    });
  }, []);

  const executeQuery = useCallback(async (dbId: string, dbName: string, sql: string) => {
    const trimmedSql = sql.trim();
    if (!trimmedSql) return;
    if (activeExecutionRef.current) return;

    setIsExecuting(true);
    setLastError(null);

    // Enforce query timeout from settings
    const timeoutMs = settings.queryTimeoutMs;
    let timedOut = false;

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<QueryResult>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Query timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });

    let result: QueryResult;
    const executionPromise = execSql(dbId, trimmedSql, settings.rowLimit);
    activeExecutionRef.current = executionPromise;
    // Prevent a late native rejection, after a UI timeout, from becoming an
    // unhandled promise rejection.
    void executionPromise.catch(() => undefined);
    try {
      try {
        // Task 1.6: pass maxRows so the DB caps the fetch at the source,
        // not after loading potentially millions of rows into JS memory.
        result = await Promise.race([executionPromise, timeoutPromise]);
      } catch (e) {
        if (e instanceof DatabaseCorruptError) throw e; // let DatabaseErrorBoundary handle it
        const details = timedOut
          ? {
              title: 'Query timed out',
              message: `The query exceeded the ${timeoutMs / 1000}s timeout. It will finish safely in the background before another query can run.`,
              hint: 'Try a smaller batch, add a WHERE/LIMIT clause, or increase Query Timeout in Settings.',
            }
          : formatSQLiteError(e);
        result = {
          columns: [],
          rows: [],
          rowsAffected: 0,
          executionTime: timeoutMs,
          error: details.message,
          errorTitle: details.title,
          errorHint: details.hint,
          type: 'error',
        };
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }

      setQueryResult(result);

      if (result.error) {
        setLastError(result.error);
      }

      if (!timedOut) {
        const entry: QueryHistoryEntry = {
          id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          sql: trimmedSql,
          databaseId: dbId,
          databaseName: dbName,
          timestamp: new Date().toISOString(),
          success: !result.error,
          rowCount: result.rows.length || result.rowsAffected,
          executionTime: result.executionTime,
          error: result.error,
        };

        const updated = [entry, ...historyRef.current].slice(0, 500);
        setQueryHistory(updated);
        const newTotal = totalQueriesRun + 1;
        setTotalQueriesRun(newTotal);

        await Promise.all([
          AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated)),
          AsyncStorage.setItem(STATS_KEY, JSON.stringify({ totalQueriesRun: newTotal })),
        ]);
      }
    } finally {
      setIsExecuting(false);
      if (activeExecutionRef.current === executionPromise) {
        activeExecutionRef.current = null;
      }
    }
  }, [totalQueriesRun, settings.queryTimeoutMs, settings.rowLimit]);

  const clearHistory = async () => {
    setQueryHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  const deleteHistoryEntry = async (id: string) => {
    const updated = queryHistory.filter(h => h.id !== id);
    setQueryHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const saveQuery = async (name: string, sql: string, dbId?: string): Promise<SavedQuery> => {
    const sq: SavedQuery = {
      id: `sq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      sql,
      databaseId: dbId,
      createdAt: new Date().toISOString(),
    };
    const updated = [sq, ...savedQueries];
    setSavedQueries(updated);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    return sq;
  };

  const deleteSavedQuery = async (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  };

  return (
    <EditorContext.Provider
      value={{
        currentSql,
        setCurrentSql,
        queryResult,
        isExecuting,
        lastError,
        executeQuery,
        queryHistory,
        clearHistory,
        deleteHistoryEntry,
        savedQueries,
        saveQuery,
        deleteSavedQuery,
        totalQueriesRun,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be inside EditorProvider');
  return ctx;
}
