import React from 'react';
import MobileFrame from './components/MobileFrame';

function App() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: '#030508',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
      }}
    >
      <MobileFrame />
    </div>
  );
}

export default App;
