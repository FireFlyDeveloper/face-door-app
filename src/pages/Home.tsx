import React, { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from '../components/TopBar';
import ConnectionStatus from '../components/ConnectionStatus';
import { useBluetooth, RSSI_THRESHOLD, PI_MAC, PI_NAME } from '../hooks/useBluetooth';

type Page = 'home' | 'register' | 'faces' | 'log';

interface HomeProps { onNavigate: (page: Page) => void }

// ── Styles ──────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480, margin: '0 auto', minHeight: '100vh',
    background: '#0f0f1a', color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  content: { padding: 16 },
  card: { background: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardAccent: {
    background: 'linear-gradient(135deg, #1a2a1e 0%, #1a1a2e 100%)',
    borderRadius: 12, padding: 20, marginBottom: 16,
    border: '1px solid #2a4a3e',
  },
  heading: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#64ffda' },
  subheading: { fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#888' },
  error: { color: '#ff1744', fontSize: 13, marginTop: 8 },
  success: { color: '#00e676', fontSize: 13 },
  btn: {
    width: '100%', padding: 12, borderRadius: 8, border: 'none',
    fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimary: { background: '#64ffda', color: '#0f0f1a' },
  btnDanger: { background: '#ff1744', color: '#fff' },
  btnSecondary: { background: '#2a2a3e', color: '#e0e0e0' },
  btnSmall: {
    background: 'transparent', border: '1px solid #64ffda', color: '#64ffda',
    borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  deviceRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid #2a2a3e',
  },
  deviceInfo: { flex: 1, minWidth: 0 },
  deviceName: { fontSize: 14, fontWeight: 600, color: '#e0e0e0' },
  deviceMac: { fontSize: 11, color: '#666', fontFamily: 'monospace', marginTop: 1 },
  piBadge: {
    display: 'inline-block', background: '#00e67622', color: '#00e676',
    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
    marginLeft: 6, verticalAlign: 'middle',
  },
  rssiBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 0', marginTop: 8, borderTop: '1px solid #2a2a3e',
  },
  rssiMeter: { height: 6, borderRadius: 3, flex: 1, background: '#2a2a3e', overflow: 'hidden' },
  rssiFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s, background 0.5s' },
  navGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  navBtn: {
    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 12,
    padding: 16, cursor: 'pointer', textAlign: 'left' as const,
    color: '#e0e0e0', fontSize: 14, fontWeight: 500, transition: 'border-color 0.2s',
  },
  navLabel: { fontSize: 11, color: '#64ffda', marginTop: 4 },
  reconnectBar: {
    background: '#16213e', borderRadius: 8, padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

function rssiPct(rssi: number): number {
  return Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
}

function rssiColor(rssi: number): string {
  if (rssi >= -50) return '#00e676';
  if (rssi >= -70) return '#64ffda';
  if (rssi >= -80) return '#ffab00';
  return '#ff1744';
}

// ── NavButton ───────────────────────────────────────────────────────────

function NavBtn({ icon, title, desc, onClick, disabled, warn }: {
  icon: string; title: string; desc: string; onClick: () => void;
  disabled?: boolean; warn?: string;
}) {
  return (
    <button style={{
      ...S.navBtn, opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }} onClick={onClick} disabled={disabled}>
      <div>{icon} {title}</div>
      <div style={S.navLabel}>{warn || desc}</div>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function Home({ onNavigate }: HomeProps) {
  const bt = useBluetooth();
  const [showAll, setShowAll] = useState(false);
  const rssiTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scan paired devices on mount
  useEffect(() => { bt.listPaired(); }, []);

  // RSSI polling while connected
  useEffect(() => {
    if (bt.status === 'connected') {
      bt.pingWithRssi();
      rssiTimer.current = setInterval(() => bt.pingWithRssi(), 5000);
    }
    return () => { if (rssiTimer.current) clearInterval(rssiTimer.current); };
  }, [bt.status]);

  // Auto-connect to last device on idle
  const handleQuickConnect = useCallback(async () => {
    await bt.connect(PI_MAC);
  }, [bt]);

  const handleReconnect = useCallback(async () => {
    if (bt.lastMac) await bt.connect(bt.lastMac);
  }, [bt]);

  const devices = bt.pairedDevices;
  const proximityReq = bt.status === 'connected' && bt.isNearby === false;
  const proxMsg = bt.isNearby === false
    ? `📡 Move closer (${bt.rssi} dBm, need ≥${RSSI_THRESHOLD})` : undefined;

  return (
    <div style={S.container}>
      <TopBar title="Face Door System" />
      <ConnectionStatus bt={bt} />
      <div style={S.content}>

        {/* ── Reconnect prompt (when idle and known Pi) ─────────────── */}
        {bt.status === 'idle' && bt.lastMac && (
          <div style={S.reconnectBar}>
            <span style={{ flex: 1, fontSize: 13, color: '#888' }}>
              Last connected to {bt.lastMac === PI_MAC ? PI_NAME : bt.lastMac}
            </span>
            <button style={S.btnSmall} onClick={handleReconnect}>
              Reconnect
            </button>
          </div>
        )}

        {/* ── Connection Card ──────────────────────────────────────── */}
        {bt.status === 'connected' ? (
          <div style={S.card}>
            <div style={S.heading}>
              ✅ Connected
              {bt.isPi && <span style={S.piBadge}>DOOR PI</span>}
            </div>
            <div style={{ fontSize: 13, color: '#888' }}>
              {bt.connectedDevice?.name || bt.connectedDevice?.address}
            </div>
            <div style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', marginTop: 2 }}>
              {bt.connectedDevice?.address}
            </div>

            {/* RSSI Meter */}
            {bt.rssi !== null && (
              <div style={S.rssiBar}>
                <div style={S.rssiMeter}>
                  <div style={{
                    ...S.rssiFill, width: `${rssiPct(bt.rssi)}%`,
                    background: rssiColor(bt.rssi),
                  }} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: bt.isNearby ? '#00e67622' : '#ff174422',
                  color: bt.isNearby ? '#00e676' : '#ff1744',
                }}>{bt.rssi} dBm</span>
              </div>
            )}

            {bt.isNearby === false && (
              <div style={{ fontSize: 12, color: '#ffab00', marginTop: 8 }}>
                📡 Move closer to the door to register or delete faces
              </div>
            )}

            <button style={{ ...S.btn, ...S.btnDanger, marginTop: 12 }} onClick={bt.disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <div style={S.card}>
            <div style={S.heading}>Connect to Door Pi</div>

            {/* Quick connect to known Pi */}
            <button style={{ ...S.btn, ...S.btnPrimary, marginBottom: 12 }}
              onClick={handleQuickConnect}
              disabled={bt.status === 'connecting'}>
              {bt.status === 'connecting' ? (
                <>⏳ Connecting...</>
              ) : (
                <>🔗 Connect to {PI_NAME}</>
              )}
            </button>

            {bt.error && <div style={S.error}>{bt.error}</div>}

            {/* Paired devices list */}
            {devices.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={S.subheading}>
                  Paired Devices {devices.length > 3 && !showAll && (
                    <span onClick={() => setShowAll(true)}
                      style={{ color: '#64ffda', cursor: 'pointer', fontSize: 12 }}>
                      (show all {devices.length})
                    </span>
                  )}
                </div>
                {(showAll ? devices : devices.slice(0, 3)).map((d) => (
                  <div key={d.address} style={S.deviceRow}>
                    <div style={S.deviceInfo}>
                      <div style={S.deviceName}>
                        {d.name || 'Unknown'}
                        {d.address === PI_MAC && <span style={S.piBadge}>PI</span>}
                      </div>
                      <div style={S.deviceMac}>{d.address}</div>
                    </div>
                    <button style={{ ...S.btnSmall, flexShrink: 0 }}
                      onClick={() => bt.connect(d.address)}>
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Refresh */}
            <button style={{ ...S.btn, ...S.btnSecondary, marginTop: 12 }}
              onClick={bt.listPaired}>
              🔄 Refresh Device List
            </button>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────────── */}
        <div style={S.navGrid}>
          <NavBtn icon="📷" title="Register Face"
            desc={proxMsg || 'Auto-capture 10 face angles'}
            onClick={() => onNavigate('register')}
            disabled={bt.status !== 'connected' || proximityReq}
            warn={proxMsg} />
          <NavBtn icon="👤" title="Manage Faces"
            desc={proxMsg || 'View and delete registered faces'}
            onClick={() => onNavigate('faces')}
            disabled={bt.status !== 'connected' || proximityReq}
            warn={proxMsg} />
          <NavBtn icon="📋" title="Activity Log"
            desc="Pull door access log from Pi"
            onClick={() => onNavigate('log')}
            disabled={bt.status !== 'connected'} />
        </div>

        {/* Connection guide */}
        {bt.status === 'idle' && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#555', textAlign: 'center' }}>
            Make sure your phone's Bluetooth is ON and paired with the Door Pi.
            <br />Then tap "Connect to {PI_NAME}" above.
          </div>
        )}
      </div>
    </div>
  );
}
