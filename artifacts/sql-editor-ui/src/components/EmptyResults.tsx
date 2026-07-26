import React from 'react';
import { Grid2x2 } from 'lucide-react';

export default function EmptyResults() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: '220px',
        background: 'linear-gradient(180deg, #0D1525 0%, #060A12 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      {/* Icon container */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Glow container */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'radial-gradient(circle at center, rgba(59,130,246,0.35) 0%, transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(59,130,246,0.5)',
            position: 'relative',
          }}
        >
          {/* Grid icon — 2x2 rounded squares */}
          <Grid2x2
            size={38}
            color="#3B82F6"
            strokeWidth={1.5}
            style={{
              filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.8))',
            }}
          />
        </div>

        {/* Platform ellipse glow */}
        <div
          style={{
            width: '60px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59,130,246,0.2)',
            filter: 'blur(8px)',
            marginTop: '4px',
          }}
        />
      </div>

      {/* No Results Yet */}
      <h3
        style={{
          color: '#ffffff',
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: 'Inter, system-ui, sans-serif',
          marginTop: '20px',
          marginBottom: 0,
          textAlign: 'center',
        }}
      >
        No Results Yet
      </h3>

      {/* Subtitle */}
      <p
        style={{
          color: '#64748B',
          fontSize: '13px',
          fontFamily: 'Inter, system-ui, sans-serif',
          marginTop: '6px',
          textAlign: 'center',
        }}
      >
        Select a database, then write a query
      </p>
    </div>
  );
}
