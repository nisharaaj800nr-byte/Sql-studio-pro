import React from 'react';
import { Database, Bookmark, Filter, Save, ChevronDown } from 'lucide-react';

export default function DatabaseSelector() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        gap: '8px',
      }}
    >
      {/* Database selector pill */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '0 12px',
          height: '44px',
          cursor: 'pointer',
        }}
      >
        <Database size={16} color="#22D3EE" strokeWidth={1.5} />
        <span
          style={{
            flex: 1,
            color: '#64748B',
            fontSize: '14px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Select database...
        </span>
        <ChevronDown size={16} color="#64748B" strokeWidth={2} />
      </div>

      {/* Bookmark button */}
      <button
        style={{
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Bookmark size={18} color="#64748B" strokeWidth={1.5} />
      </button>

      {/* Filter button */}
      <button
        style={{
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Filter size={18} color="#64748B" strokeWidth={1.5} />
      </button>

      {/* Save button */}
      <button
        style={{
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Save size={18} color="#64748B" strokeWidth={1.5} />
      </button>
    </div>
  );
}
