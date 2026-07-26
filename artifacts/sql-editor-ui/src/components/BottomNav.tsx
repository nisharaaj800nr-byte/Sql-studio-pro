import React from 'react';
import { Home, Database, Terminal, Code2, Clock, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', active: false },
  { icon: Database, label: 'Database', active: false },
  { icon: Terminal, label: 'Editor', active: true },
  { icon: Code2, label: 'Code', active: false },
  { icon: Clock, label: 'History', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

export default function BottomNav() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(10,14,24,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 0 24px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
      }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
        <button
          key={label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 4px',
            position: 'relative',
          }}
        >
          {/* Icon area */}
          {active ? (
            <div
              style={{
                width: '44px',
                height: '28px',
                borderRadius: '14px',
                background: 'linear-gradient(90deg, #6366F1, #3B82F6)',
                boxShadow: '0 4px 12px rgba(99,102,241,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={16} color="#ffffff" strokeWidth={2} />
            </div>
          ) : (
            <div
              style={{
                width: '44px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color="#64748B" strokeWidth={1.5} />
            </div>
          )}

          {/* Label */}
          <span
            style={{
              color: active ? '#ffffff' : '#64748B',
              fontSize: '12px',
              fontWeight: active ? 700 : 400,
              fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: 1,
            }}
          >
            {label}
          </span>

          {/* Blue dot for active */}
          {active && (
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#4F8DFF',
                position: 'absolute',
                bottom: '-8px',
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
