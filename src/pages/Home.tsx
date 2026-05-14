import React, { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar';
import ConnectionStatus from '../components/ConnectionStatus';
import { useBluetooth, RSSI_THRESHOLD } from '../hooks/useBluetooth';

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    background: '#0f0f1a',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { padding: 16 },
  card: {
    background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 16,
  },
  heading: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#64ffda' },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #333',
    background: '#16213e', color: '#e0e0e0', fontSize: 15, marginBottom: 12,
    boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #333',
    background: '#16213e', color: '#e0e0e0', fontSize: 15, marginBottom: 12,
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: 12, borderRadius: 8, border: 'none',
    fontWeight: 600, fontSize: 15, cursor: 'pointer',
  },
  btnPrimary: { background: '#64ffda', color: '#0f0f1a' },
  btnDanger: { background: '#ff1744', color: '#fff' },
  btnSecondary: { background: '#2a2a3e', color: '#e0e0e0' },
  btnOutline: {
    background: 'transparent', border: '1px solid #64ffda', color: '#64ffda',
    padding: 12, borderRadius: 8, fontWeight: 600, fontSize: 15,
    cursor: 'pointer', width: '100%',
  },
  error: { color: '#ff1744', fontSize: 13, marginTop: 8 },
  grid: { display: 'flex', flexDirection: 'column', gap: 12 },
  navBtn: {
    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 12,
    padding: 20, cursor: 'pointer', textAlign: 'left' as const,
    color: '#e0e0e0', fontSize: 15, fontWeight: 500,
  },
  navBtnLabel: { fontSize: 12, color: '#64ffda', marginTop: 4 },
  rssiBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 0', marginTop: 8, borderTop: '1px solid #2a2a3e',
  },
  rssiMeter: { height: 6, borderRadius: 3, flex: 1, background: '#2a2a3e', overflow: 'hidden' },
  rssiFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s, background 0.5s' },
  proximityBadge: {
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
  },
  // Unlock/Lock section
  doorRow: {
    display: 'flex', gap: 12, marginBottom: 16,
  },
  doorBtn: {
    flex: 1, borderRadius: 12, border: 'none',
    padding: 24, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', textAlign: 'center' as const,
    transition: 'transform 0.1s, opacity 0.2s',
  },
  doorBtnUnlock: {
    background: 'linear-gradient(135deg, #00c853, #00e676)',
    color: '#0f0f1a',
  },
  doorBtnLock: {
    background: 'linear-gradient(135deg, #ff6d00, #ff9100)',
    color: '#0f0f1a',
  },
  doorBtnDisabled: {
    opacity: 0.4, cursor: 'not-allowed',
  },
  doorBtnActive: {
    transform: 'scale(0.96)',
  },
  doorEmoji: { fontSize: 32, display: 'block', marginBottom: 6 },
  doorLabel: { fontSize: 13, fontWeight: 600 },
  feedbackText: {
    fontSize: 13, textAlign: 'center' as const, marginBottom: 8,
    padding: '8px 12px', borderRadius: 8,
  },
  feedbackSuccess: {
    background: '#00e67622', color: '#00e676',
  },
  feedbackError: {
    background: '#ff174422', color: '#ff1744',
  },
};

interface NavButtonProps {
  title: string; label: string; onClick: () => void;
  disabled?: boolean; proximityWarning?: string;
}

function NavButton({ title, label, onClick, disabled, proximityWarning }: NavButtonProps) {
  return (
    <button
      style={{
        ...styles.navBtn,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={styles.navBtnLabel}>{proximityWarning || label}</div>
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface HomeProps { onNavigate: (page: any) => void }

function rssiToPercent(rssi: number): number {
  // RSSI range: -30 (excellent) to -90 (barely there)
  return Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
}

function rssiColor(rssi: number): string {
  if (rssi >= -50) return '#00e676';    // excellent
  if (rssi >= -70) return '#64ffda';    // good (within threshold)
  if (rssi >= -80) return '#ffab00';    // weak
  return '#ff1744';                      // very weak
}

export default function Home({ onNavigate }: HomeProps) {
  const bt = useBluetooth();
  const [address, setAddress] = useState('');
  const [pairedList, setPairedList] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [showPaired, setShowPaired] = useState(false);
  const rssiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Door control state
  const [doorLoading, setDoorLoading] = useState<'idle' | 'unlocking' | 'locking'>('idle');
  const [doorFeedback, setDoorFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll RSSI every 5s while connected
  useEffect(() => {
    if (bt.status === 'connected') {
      bt.pingWithRssi(); // initial read
      rssiTimerRef.current = setInterval(() => bt.pingWithRssi(), 5000);
    }
    return () => {
      if (rssiTimerRef.current) clearInterval(rssiTimerRef.current);
    };
  }, [bt.status]);

  // Clear feedback after 3s
  useEffect(() => {
    if (doorFeedback) {
      feedbackTimerRef.current = setTimeout(() => setDoorFeedback(null), 3000);
    }
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [doorFeedback]);

  const handleConnect = async () => {
    if (!address.trim()) return;
    await bt.connect(address.trim());
  };

  const handleScan = async () => {
    bt.listPaired();
    setPairedList(bt.pairedDevices);
    setShowPaired(true);
  };

  const handleUnlock = async () => {
    if (doorLoading !== 'idle') return;
    setDoorLoading('unlocking');
    setDoorFeedback(null);
    const result = await bt.unlockDoor();
    setDoorLoading('idle');
    setDoorFeedback({
      ok: result.ok,
      text: result.ok ? '🔓 Door unlocked!' : `❌ ${result.error}`,
    });
  };

  const handleLock = async () => {
    if (doorLoading !== 'idle') return;
    setDoorLoading('locking');
    setDoorFeedback(null);
    const result = await bt.lockDoor();
    setDoorLoading('idle');
    setDoorFeedback({
      ok: result.ok,
      text: result.ok ? '🔒 Door locked!' : `❌ ${result.error}`,
    });
  };

  const proximityRequired =
    bt.status === 'connected' && bt.isNearby === false;
  const proximityMsg =
    bt.isNearby === false
      ? `📡 Move closer (RSSI: ${bt.rssi} dBm, need ≥${RSSI_THRESHOLD})`
      : undefined;

  return (
    <div style={styles.container}>
      <TopBar title="Face Door System" />
      <ConnectionStatus bt={bt} />

      <div style={styles.content}>
        {/* Bluetooth Connection Card */}
        <div style={styles.card}>
          <div style={styles.heading}>Bluetooth Connection</div>

          {bt.status === 'connected' ? (
            <div>
              <div style={{ marginBottom: 12, fontSize: 14 }}>
                ✅ Connected to {bt.connectedDevice?.address}
              </div>

              {/* RSSI Meter */}
              {bt.rssi !== null && (
                <div style={styles.rssiBar}>
                  <div style={styles.rssiMeter}>
                    <div style={{
                      ...styles.rssiFill,
                      width: `${rssiToPercent(bt.rssi)}%`,
                      background: rssiColor(bt.rssi),
                    }} />
                  </div>
                  <span style={{
                    ...styles.proximityBadge,
                    background: bt.isNearby ? '#00e67622' : '#ff174422',
                    color: bt.isNearby ? '#00e676' : '#ff1744',
                  }}>
                    {bt.rssi} dBm
                  </span>
                </div>
              )}

              {bt.isNearby === false && (
                <div style={{ fontSize: 12, color: '#ffab00', marginBottom: 8 }}>
                  📡 Move closer to the door to register or delete faces
                </div>
              )}

              <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={bt.disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <input style={styles.input}
                placeholder="Pi Bluetooth MAC address (e.g. B8:27:EB:...)"
                value={address} onChange={(e) => setAddress(e.target.value)}
              />
              <div style={styles.grid}>
                <button style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleConnect} disabled={bt.status === 'connecting'}>
                  {bt.status === 'connecting' ? 'Connecting...' : 'Connect'}
                </button>
                {!showPaired ? (
                  <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={handleScan}>
                    Scan Paired Devices
                  </button>
                ) : (
                  <select style={styles.select}
                    onChange={(e) => setAddress(e.target.value)} value={address}>
                    <option value="">Select a paired device...</option>
                    {pairedList.map((d) => (
                      <option key={d.address} value={d.address}>{d.name || d.address}</option>
                    ))}
                  </select>
                )}
              </div>
              {bt.error && <div style={styles.error}>{bt.error}</div>}
            </div>
          )}
        </div>

        {/* Door Control (only when connected) */}
        {bt.status === 'connected' && (
          <div>
            {/* Feedback toast */}
            {doorFeedback && (
              <div style={{
                ...styles.feedbackText,
                ...(doorFeedback.ok ? styles.feedbackSuccess : styles.feedbackError),
              }}>
                {doorFeedback.text}
              </div>
            )}

            <div style={styles.doorRow}>
              <button
                style={{
                  ...styles.doorBtn,
                  ...styles.doorBtnUnlock,
                  ...(doorLoading !== 'idle' ? styles.doorBtnDisabled : {}),
                  ...(doorLoading === 'unlocking' ? styles.doorBtnActive : {}),
                }}
                onClick={handleUnlock}
                disabled={doorLoading !== 'idle'}
              >
                <span style={styles.doorEmoji}>
                  {doorLoading === 'unlocking' ? '⏳' : '🔓'}
                </span>
                <span style={styles.doorLabel}>
                  {doorLoading === 'unlocking' ? 'Unlocking...' : 'Unlock Door'}
                </span>
              </button>

              <button
                style={{
                  ...styles.doorBtn,
                  ...styles.doorBtnLock,
                  ...(doorLoading !== 'idle' ? styles.doorBtnDisabled : {}),
                  ...(doorLoading === 'locking' ? styles.doorBtnActive : {}),
                }}
                onClick={handleLock}
                disabled={doorLoading !== 'idle'}
              >
                <span style={styles.doorEmoji}>
                  {doorLoading === 'locking' ? '⏳' : '🔒'}
                </span>
                <span style={styles.doorLabel}>
                  {doorLoading === 'locking' ? 'Locking...' : 'Lock Door'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Cards */}
        <div style={styles.grid}>
          <NavButton
            title="📷 Register Face"
            label="Capture 10 face angles via Bluetooth"
            onClick={() => onNavigate('register')}
            disabled={bt.status !== 'connected' || proximityRequired}
            proximityWarning={proximityMsg}
          />
          <NavButton
            title="👤 Manage Faces"
            label="View and delete registered faces on Pi"
            onClick={() => onNavigate('faces')}
            disabled={bt.status !== 'connected' || proximityRequired}
            proximityWarning={proximityMsg}
          />
          <NavButton
            title="📋 Activity Log"
            label="Pull access log from Pi (no proximity required)"
            onClick={() => onNavigate('log')}
            disabled={bt.status !== 'connected'}
          />
        </div>
      </div>
    </div>
  );
}
