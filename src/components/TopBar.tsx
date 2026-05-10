import React from 'react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#e0e0e0',
    minHeight: 56,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64ffda',
    fontSize: 20,
    cursor: 'pointer',
    padding: '4px 12px 4px 0',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    flex: 1,
  },
};

export default function TopBar({ title, onBack }: TopBarProps) {
  return (
    <div style={styles.bar}>
      {onBack && (
        <button style={styles.backBtn} onClick={onBack} aria-label="Back">
          ←
        </button>
      )}
      <span style={styles.title}>{title}</span>
    </div>
  );
}
