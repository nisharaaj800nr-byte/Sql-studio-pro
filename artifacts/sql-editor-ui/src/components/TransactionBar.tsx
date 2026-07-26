import React from 'react';
import { Sparkles, Settings, Play } from 'lucide-react';

export default function TransactionBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#0D1220',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* BEGIN button */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          padding: '6px 14px',
          cursor: 'pointer',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <Play size={10} fill="#ffffff" color="#ffffff" />
        BEGIN
      </button>

      {/* Right side buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Sparkles/AI button */}
        <button
          style={{
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={16} color="#64748B" strokeWidth={1.5} />
        </button>

        {/* Settings button */}
        <button
          style={{
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <Settings size={16} color="#64748B" strokeWidth={1.5} />
        </button>

        {/* Run button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(90deg, #6366F1, #3B82F6)',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 18px',
            cursor: 'pointer',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          }}
        >
          <Play size={11} fill="#ffffff" color="#ffffff" />
          Run
        </button>
      </div>
    </div>
  );
}
