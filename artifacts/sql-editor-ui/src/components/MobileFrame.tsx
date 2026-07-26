import React from 'react';
import StatusBar from './StatusBar';
import DatabaseSelector from './DatabaseSelector';
import QueryTabs from './QueryTabs';
import TransactionBar from './TransactionBar';
import CodeEditor from './CodeEditor';
import InfoBar from './InfoBar';
import KeywordChips from './KeywordChips';
import EmptyResults from './EmptyResults';
import BottomNav from './BottomNav';

export default function MobileFrame() {
  return (
    <div
      style={{
        width: '390px',
        height: '844px',
        borderRadius: '40px',
        overflow: 'hidden',
        backgroundColor: '#070B14',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      {/* Status Bar */}
      <StatusBar />

      {/* Database Selector */}
      <DatabaseSelector />

      {/* Query Tabs */}
      <QueryTabs />

      {/* Transaction Toolbar */}
      <TransactionBar />

      {/* Code Editor */}
      <CodeEditor />

      {/* Info Bar */}
      <InfoBar />

      {/* Keyword Chips */}
      <KeywordChips />

      {/* Empty Results */}
      <EmptyResults />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
