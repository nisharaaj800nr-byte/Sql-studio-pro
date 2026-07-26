import React from 'react';
import { Info, ChevronDown } from 'lucide-react';

export default function InfoBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: '#0D1220',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Left: info + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Info size={11} color="#ffffff" strokeWidth={2.5} />
        </div>
        <span
          style={{
            color: '#64748B',
            fontSize: '11px',
            fontFamily: 'Inter, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          Ln 2, Col 1 · SELECT * returns every column · See by columns exp...
        </span>
      </div>

      {/* Right: chevron */}
      <ChevronDown size={14} color="#64748B" strokeWidth={2} style={{ flexShrink: 0, marginLeft: '8px' }} />
    </div>
  );
}
