import React, { useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildGetLog, type BTResponse } from '../services/protocol';

interface LogEntry {
  timestamp: string;
  face_id: string;
  result: string;
  details?: string;
}

interface Props {
  onBack: () => void;
  bt: ReturnType<typeof useBluetooth>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    background: '#0f0f1a',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: {
    padding: 16,
  },
  card: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: '#64ffda',
  },
  btn: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    border: 'none',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#64ffda',
    color: '#0f0f1a',
  },
  error: {
    color: '#ff1744',
    fontSize: 13,
    marginTop: 8,
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#666',
    fontSize: 14,
  },
  entry: {
    background: '#16213e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeft: '3px solid #333',
  },
  entryGranted: {
    borderLeft: '3px solid #00e676',
  },
  entryRejected: {
    borderLeft: '3px solid #ff1744',
  },
  entryTime: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  entryFaceId: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 2,
  },
  entryResult: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: 600,
  },
  entryDetails: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
};

export default function ActivityLog({ onBack, bt }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = (await bt.sendCommand(buildGetLog(100))) as unknown as BTResponse;
      if (response.status === 'OK' && response.entries) {
        setEntries(response.entries);
      } else {
        setError(response.message || 'Failed to load log');
        setEntries([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [bt]);

  return (
    <div style={styles.container}>
      <TopBar title="Activity Log" onBack={onBack} />

      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.heading}>Door Access Log</div>
          <button
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={loadLog}
            disabled={loading}
          >
            {loading ? 'Loading...' : '🔄 Pull Latest Log'}
          </button>
          {error && <div style={styles.error}>{error}</div>}
        </div>

        {entries.length === 0 && !loading ? (
          <div style={styles.emptyState}>
            No activity entries yet.
            <br />
            Press "Pull Latest Log" to fetch from Pi.
          </div>
        ) : (
          entries.map((entry, i) => {
            const isGranted = entry.result === 'GRANTED';
            const isRejected = entry.result === 'REJECTED';
            const time = new Date(entry.timestamp).toLocaleString();

            return (
              <div
                key={i}
                style={{
                  ...styles.entry,
                  ...(isGranted ? styles.entryGranted : {}),
                  ...(isRejected ? styles.entryRejected : {}),
                }}
              >
                <div style={styles.entryTime}>{time}</div>
                <div style={styles.entryFaceId}>
                  {entry.face_id === 'unknown' ? '⚠️ Unknown' : entry.face_id}
                </div>
                <div
                  style={{
                    ...styles.entryResult,
                    color: isGranted ? '#00e676' : isRejected ? '#ff1744' : '#ffab00',
                  }}
                >
                  {entry.result}
                </div>
                {entry.details && (
                  <div style={styles.entryDetails}>{entry.details}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
