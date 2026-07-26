import React from 'react';
import { X, Plus } from 'lucide-react';

export default function QueryTabs() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        overflowX: 'auto',
      }}
      className="scrollbar-hidden"
    >
      {/* Active tab */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 12px',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Query 1
        </span>
        <X size={12} color="#64748B" strokeWidth={2} style={{ cursor: 'pointer' }} />
        {/* Blue underline indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '12px',
            right: '12px',
            height: '2px',
            backgroundColor: '#4F8DFF',
            borderRadius: '1px 1px 0 0',
          }}
        />
      </div>

      {/* Add tab button */}
      <button
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginLeft: '4px',
          flexShrink: 0,
        }}
      >
        <Plus size={16} color="#64748B" strokeWidth={2} />
      </button>
    </div>
  );
}
