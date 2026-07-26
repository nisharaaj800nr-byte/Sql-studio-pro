import React from 'react';

export default function StatusBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 6px',
        backgroundColor: 'transparent',
      }}
    >
      {/* Time */}
      <span
        style={{
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '-0.3px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        9:41
      </span>

      {/* Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Signal bars */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
          <rect x="0" y="7" width="3" height="5" rx="0.5" fill="white" />
          <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.5" fill="white" />
          <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white" />
          <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white" />
        </svg>

        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 9.5C8.69 9.5 9.25 10.06 9.25 10.75C9.25 11.44 8.69 12 8 12C7.31 12 6.75 11.44 6.75 10.75C6.75 10.06 7.31 9.5 8 9.5Z" fill="white"/>
          <path d="M8 6C9.66 6 11.16 6.67 12.26 7.74L13.33 6.67C11.93 5.31 10.06 4.5 8 4.5C5.94 4.5 4.07 5.31 2.67 6.67L3.74 7.74C4.84 6.67 6.34 6 8 6Z" fill="white"/>
          <path d="M8 2.5C10.76 2.5 13.26 3.58 15.1 5.36L16.17 4.29C14.04 2.22 11.17 1 8 1C4.83 1 1.96 2.22 -0.17 4.29L0.9 5.36C2.74 3.58 5.24 2.5 8 2.5Z" fill="white" opacity="0.5"/>
        </svg>

        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.7"/>
          <rect x="2" y="2" width="17" height="8" rx="2" fill="white"/>
          <path d="M23 4.5V7.5C23.83 7.17 24.5 6.5 24.5 6C24.5 5.5 23.83 4.83 23 4.5Z" fill="white" fillOpacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}
