import { useState, useCallback, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { loadLog(); }, [loadLog]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <TopBar title="Activity Log" onBack={onBack} />
      <div style={{ padding: 16 }}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>
            Door Access Log
            {entries.length > 0 && (
              <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>
                ({entries.length})
              </span>
            )}
          </div>
          <button onClick={loadLog} disabled={loading}
            style={{
              background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted,
              borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
            }}>
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>

        {error && (
          <div style={{
            background: '#ffebee', color: theme.danger, fontSize: 13, padding: '10px 14px',
            borderRadius: 8, marginBottom: 12,
          }}>{error}</div>
        )}

        {loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
            Loading activity log...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
            No activity entries yet.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry, i) => {
            const isGranted = entry.result === 'GRANTED';
            const isRejected = entry.result === 'REJECTED';
            const isUnknown = entry.face_id === 'unknown';
            return (
              <div key={i} style={{
                background: theme.card, borderRadius: 12, padding: 14,
                border: `1px solid ${theme.border}`,
                borderLeft: `4px solid ${
                  isGranted ? theme.success : isRejected ? theme.danger : theme.warning
                }`,
                boxShadow: theme.shadowCard,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                      {isUnknown ? 'Unknown Person' : entry.face_id}
                    </div>
                    {entry.details && (
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {entry.details}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                    background: isGranted ? '#e8f5e9' : isRejected ? '#ffebee' : '#fff8e1',
                    color: isGranted ? theme.success : isRejected ? theme.danger : theme.warning,
                  }}>
                    {isGranted ? 'Granted' : isRejected ? 'Denied' : entry.result}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', marginTop: 6 }}>
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
