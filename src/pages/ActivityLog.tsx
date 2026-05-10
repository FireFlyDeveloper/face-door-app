import { useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildGetLog, type BTResponse } from '../services/protocol';
import { theme } from '../theme';

interface LogEntry {
  timestamp: string; face_id: string; result: string; details?: string;
}
interface Props { onBack: () => void; bt: ReturnType<typeof useBluetooth> }

export default function ActivityLog({ onBack, bt }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLog = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const resp = (await bt.sendCommand(buildGetLog(100))) as unknown as BTResponse;
      if (resp.status === 'OK' && resp.entries) setEntries(resp.entries);
      else { setError(resp.message || 'Failed to load log'); setEntries([]); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally { setLoading(false); }
  }, [bt]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <TopBar title="Activity Log" onBack={onBack} />
      <div style={{ padding: 16 }}>
        <div style={{
          background: theme.card, borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: theme.shadowCard,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: theme.accentText }}>
            Door Access Log
          </div>
          <button style={{
            width: '100%', padding: 12, borderRadius: 8, border: 'none',
            background: theme.accent, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }} onClick={loadLog} disabled={loading}>
            {loading ? 'Loading...' : '🔄 Pull Latest Log'}
          </button>
          {error && <div style={{ color: theme.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>

        {entries.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
            No activity entries yet.<br />Press "Pull Latest Log" to fetch from Pi.
          </div>
        ) : (
          entries.map((entry, i) => {
            const isGranted = entry.result === 'GRANTED';
            const isRejected = entry.result === 'REJECTED';
            const border = isGranted ? `3px solid ${theme.success}` :
              isRejected ? `3px solid ${theme.danger}` : `3px solid ${theme.warning}`;
            return (
              <div key={i} style={{
                background: theme.cardAlt, borderRadius: 8, padding: 12, marginBottom: 8,
                borderLeft: border, boxShadow: theme.shadowCard,
              }}>
                <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace' }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {entry.face_id === 'unknown' ? '⚠️ Unknown' : entry.face_id}
                </div>
                <div style={{
                  fontSize: 12, marginTop: 2, fontWeight: 600,
                  color: isGranted ? theme.success : isRejected ? theme.danger : theme.warning,
                }}>{entry.result}</div>
                {entry.details && (
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{entry.details}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
