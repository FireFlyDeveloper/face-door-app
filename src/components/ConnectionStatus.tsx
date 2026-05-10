import { theme } from '../theme';
import type { UseBluetoothReturn } from '../hooks/useBluetooth';

interface Props { bt: UseBluetoothReturn }

const STATUS_COLORS: Record<string, string> = {
  idle: '#999', connecting: '#ff8f00', connected: '#00c853', error: '#e53935',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Disconnected', connecting: 'Connecting...', connected: 'Connected', error: 'Error',
};

export default function ConnectionStatus({ bt }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', background: theme.cardAlt,
      borderBottom: `1px solid ${theme.border}`, fontSize: 13,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: STATUS_COLORS[bt.status],
      }} />
      <span style={{ color: theme.textSecondary }}>{STATUS_LABELS[bt.status]}</span>
      {bt.connectedDevice && (
        <span style={{ color: theme.accentText, fontWeight: 500 }}>
          · {bt.connectedDevice.address}
        </span>
      )}
    </div>
  );
}
