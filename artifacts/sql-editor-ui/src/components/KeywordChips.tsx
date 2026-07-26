import React from 'react';

const KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'LIMIT'];

export default function KeywordChips() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        overflowX: 'auto',
        backgroundColor: 'transparent',
      }}
      className="scrollbar-hidden"
    >
      {KEYWORDS.map((kw) => (
        <button
          key={kw}
          style={{
            flexShrink: 0,
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '8px',
            padding: '5px 12px',
            color: '#94A3B8',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.03em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {kw}
        </button>
      ))}
    </div>
  );
}
