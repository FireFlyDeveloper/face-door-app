import React, { useState, useEffect } from 'react';
import type { UseBluetoothReturn } from '../hooks/useBluetooth';

interface Props {
  bt: UseBluetoothReturn;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: '#0f0f1a',
    borderBottom: '1px solid #2a2a3e',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  label: {
    fontSize: 13,
    color: '#a0a0b0',
  },
  deviceName: {
    fontSize: 13,
    color: '#64ffda',
    fontWeight: 500,
  },
  btn: {
    marginLeft: 'auto',
    background: 'transparent',
    border: '1px solid #64ffda',
    color: '#64ffda',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnDanger: {
    marginLeft: 'auto',
    background: '#ff1744',
    border: 'none',
    color: '#fff',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#666',
  connecting: '#ffab00',
  connected: '#00e676',
  error: '#ff1744',
};

export default function ConnectionStatus({ bt }: Props) {
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (bt.status === 'connected') {
      bt.ping().then(setConnectionOk);
    } else {
      setConnectionOk(null);
    }
  }, [bt.status]);

  return (
    <div style={styles.container}>
      <div style={{ ...styles.dot, background: STATUS_COLORS[bt.status] }} />
      <span style={styles.label}>
        {bt.status === 'connected' ? 'Connected' :
         bt.status === 'connecting' ? 'Connecting...' :
         bt.status === 'error' ? 'Error' : 'Disconnected'}
      </span>
      {bt.connectedDevice && (
        <span style={styles.deviceName}>· {bt.connectedDevice.address}</span>
      )}
      {connectionOk === false && (
        <span style={{ color: '#ffab00', fontSize: 12, marginLeft: 8 }}>
          (no response)
        </span>
      )}
    </div>
  );
}
