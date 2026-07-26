/**
 * CodeContext — Phase 3.2–3.4
 * Manages multi-tab HTML / CSS / JS editor state, persisted to AsyncStorage.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CodeLanguage = 'html' | 'css' | 'js';

export interface ConsoleEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

export interface CodeTab {
  id: string;
  label: string;
  language: CodeLanguage;
  code: string;
}

interface CodeContextType {
  tabs: CodeTab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  addTab: (language: CodeLanguage) => void;
  closeTab: (id: string) => void;
  updateTabCode: (id: string, code: string) => void;
  activeTab: CodeTab;
}

const STORAGE_KEY = '@sqlstudio_code_v1';

const DEFAULTS: Record<CodeLanguage, string> = {
  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; background: #f8fafc; }
    h1   { color: #2563eb; margin-bottom: 8px; }
    p    { color: #374151; line-height: 1.6; }
    button {
      background: #2563eb; color: white; border: none;
      border-radius: 8px; padding: 8px 18px; font-size: 14px; cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h1>Hello, HTML! 👋</h1>
  <p>Edit this code and see the live preview update automatically.</p>
  <button onclick="this.textContent='Clicked! ✓'">Click me</button>
</body>
</html>`,

  css: `/* CSS Preview — your styles are applied to the sample page below */

body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 320px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

h1   { color: #4f46e5; margin: 0 0 8px; font-size: 24px; }
p    { color: #6b7280; margin: 0 0 20px; line-height: 1.5; }

button {
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 10px 24px;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  display: block;
  width: 100%;
  margin-bottom: 10px;
}
button:hover { background: #4338ca; transform: translateY(-1px); }

input {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
input:focus { border-color: #4f46e5; }`,

  js: `// JavaScript — runs in a sandboxed WebView
// console.log / warn / error output appears in the Console panel below

console.log('Hello from JS! 👋');

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const evens   = numbers.filter(n => n % 2 === 0);
const sum     = numbers.reduce((a, b) => a + b, 0);

console.log('Even numbers:', evens.join(', '));
console.log('Sum of 1–10:', sum);
console.warn('This is a warning');

// DOM output
document.body.innerHTML = \`
  <div style="font-family:system-ui;padding:20px;background:#f8fafc;min-height:100vh">
    <h2 style="color:#2563eb;margin-bottom:12px">JS is running ✓</h2>
    <p style="color:#374151">Sum of 1–10 = <strong>\${sum}</strong></p>
    <p style="color:#374151">Even numbers: <strong>\${evens.join(', ')}</strong></p>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">
      Check the Console panel below for log output.
    </p>
  </div>
\`;`,
};

const CodeContext = createContext<CodeContextType | null>(null);

let tabSeq = 10;
function makeTab(language: CodeLanguage, code?: string): CodeTab {
  const id = `c${tabSeq++}`;
  const labels: Record<CodeLanguage, string> = { html: 'HTML', css: 'CSS', js: 'JS' };
  return { id, label: labels[language], language, code: code ?? DEFAULTS[language] };
}

const INITIAL_TABS: CodeTab[] = [
  { id: 'c0', label: 'HTML', language: 'html', code: DEFAULTS.html },
  { id: 'c1', label: 'CSS',  language: 'css',  code: DEFAULTS.css  },
  { id: 'c2', label: 'JS',   language: 'js',   code: DEFAULTS.js   },
];

export function CodeProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs]               = useState<CodeTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabIdState] = useState<string>('c0');

  // Restore persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.tabs) && saved.tabs.length > 0) {
          setTabs(saved.tabs);
          setActiveTabIdState(saved.activeTabId ?? saved.tabs[0].id);
        }
      } catch { /* ignore corrupt data */ }
    });
  }, []);

  const persist = useCallback((t: CodeTab[], aid: string) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: t, activeTabId: aid }));
  }, []);

  const setActiveTabId = useCallback((id: string) => {
    setActiveTabIdState(id);
    setTabs(prev => { persist(prev, id); return prev; });
  }, [persist]);

  const addTab = useCallback((language: CodeLanguage) => {
    const tab = makeTab(language);
    setTabs(prev => {
      const updated = [...prev, tab];
      persist(updated, tab.id);
      return updated;
    });
    setActiveTabIdState(tab.id);
  }, [persist]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex(t => t.id === id);
      const remaining = prev.filter(t => t.id !== id);
      setActiveTabIdState(cur => {
        const newActive = cur === id ? remaining[Math.max(0, idx - 1)].id : cur;
        persist(remaining, newActive);
        return newActive;
      });
      return remaining;
    });
  }, [persist]);

  const updateTabCode = useCallback((id: string, code: string) => {
    setTabs(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, code } : t);
      setActiveTabIdState(cur => { persist(updated, cur); return cur; });
      return updated;
    });
  }, [persist]);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  return (
    <CodeContext.Provider value={{ tabs, activeTabId, setActiveTabId, addTab, closeTab, updateTabCode, activeTab }}>
      {children}
    </CodeContext.Provider>
  );
}

export function useCode() {
  const ctx = useContext(CodeContext);
  if (!ctx) throw new Error('useCode must be used inside CodeProvider');
  return ctx;
}
