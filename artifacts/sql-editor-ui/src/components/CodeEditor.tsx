import React from 'react';

export default function CodeEditor() {
  return (
    <div
      style={{
        backgroundColor: '#070B14',
        flex: 1,
        minHeight: '220px',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Line numbers */}
      <div
        style={{
          width: '40px',
          flexShrink: 0,
          paddingTop: '16px',
          paddingRight: '12px',
          textAlign: 'right',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              color: '#334155',
              fontSize: '14px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: '1.7',
              height: '23.8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {n}
          </div>
        ))}
      </div>

      {/* Code content */}
      <div
        style={{
          flex: 1,
          paddingTop: '16px',
          paddingRight: '16px',
          paddingBottom: '16px',
          overflow: 'hidden',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '13.5px',
          lineHeight: '1.7',
        }}
      >
        {/* Line 1: Comment */}
        <div style={{ height: '23.8px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#6B7A4A' }}>-- Welcome to SQL Studio Pro</span>
        </div>

        {/* Line 2: SELECT query */}
        <div style={{ height: '23.8px', display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
          <span style={{ color: '#4F8DFF', fontWeight: 600 }}>SELECT</span>
          <span style={{ color: '#94A3B8' }}>&nbsp;*&nbsp;</span>
          <span style={{ color: '#94A3B8' }}>FROM&nbsp;</span>
          <span style={{ color: '#F1F5F9', fontWeight: 600 }}>sqlite_master</span>
          <span style={{ color: '#4F8DFF', fontWeight: 600 }}>&nbsp;WHERE</span>
          <span style={{ color: '#94A3B8' }}>&nbsp;type&nbsp;=</span>
          {/* Blinking cursor */}
          <span
            className="cursor-blink"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '16px',
              backgroundColor: '#4F8DFF',
              marginLeft: '1px',
              borderRadius: '1px',
              verticalAlign: 'middle',
            }}
          />
        </div>

        {/* Line 3: String */}
        <div style={{ height: '23.8px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#E06C75' }}>'table';</span>
        </div>
      </div>
    </div>
  );
}
