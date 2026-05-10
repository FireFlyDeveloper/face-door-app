import React, { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from '../components/TopBar';
import ConnectionStatus from '../components/ConnectionStatus';
import { useBluetooth, RSSI_THRESHOLD, PI_MAC, PI_NAME } from '../hooks/useBluetooth';
import { theme } from '../theme';

type Page = 'home' | 'register' | 'faces' | 'log';
interface HomeProps { onNavigate: (page: Page) => void }

function rssiPct(rssi: number): number {
  return Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
}
function rssiColor(rssi: number): string {
  if (rssi >= -50) return '#00c853';
  if (rssi >= -70) return theme.accent;
  if (rssi >= -80) return '#ff8f00';
  return '#e53935';
}

function NavBtn({ icon, title, desc, onClick, disabled, warn }: {
  icon: string; title: string; desc: string; onClick: () => void;
  disabled?: boolean; warn?: string;
}) {
  return (
    <button style={{
      background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12,
      padding: 16, cursor: disabled ? 'not-allowed' : 'pointer',
      textAlign: 'left', color: theme.text, fontSize: 14, fontWeight: 500,
      opacity: disabled ? 0.5 : 1,
    }} onClick={onClick} disabled={disabled}>
      <div>{icon} {title}</div>
      <div style={{ fontSize: 11, color: warn ? '#ff8f00' : theme.accent, marginTop: 4 }}>
        {warn || desc}
      </div>
    </button>
  );
}

export default function Home({ onNavigate }: HomeProps) {
  const bt = useBluetooth();
  const [showAll, setShowAll] = useState(false);
  const rssiTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { bt.listPaired(); }, []);
  useEffect(() => {
    if (bt.status === 'connected') {
      bt.pingWithRssi();
      rssiTimer.current = setInterval(() => bt.pingWithRssi(), 5000);
    }
    return () => { if (rssiTimer.current) clearInterval(rssiTimer.current); };
  }, [bt.status]);

  const handleQuickConnect = useCallback(async () => { await bt.connect(PI_MAC); }, [bt]);
  const handleReconnect = useCallback(async () => {
    if (bt.lastMac) await bt.connect(bt.lastMac);
  }, [bt]);

  const devices = bt.pairedDevices;
  const proximityReq = bt.status === 'connected' && bt.isNearby === false;
  const proxMsg = bt.isNearby === false
    ? `📡 Move closer (${bt.rssi} dBm, need ≥${RSSI_THRESHOLD})` : undefined;

  const card: React.CSSProperties = {
    background: theme.card, borderRadius: 12, padding: 20, marginBottom: 16,
    boxShadow: theme.shadowCard,
  };
  const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 12, color: theme.accentText };
  const sub: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 8, color: theme.textMuted };
  const btnBase: React.CSSProperties = {
    width: '100%', padding: 12, borderRadius: 8, border: 'none',
    fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <TopBar title="Face Door System" />
      <ConnectionStatus bt={bt} />
      <div style={{ padding: 16 }}>

        {/* Reconnect */}
        {bt.status === 'idle' && bt.lastMac && (
          <div style={{
            background: theme.cardAlt, borderRadius: 8, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
          }}>
            <span style={{ flex: 1, fontSize: 13, color: theme.textMuted }}>
              Last connected to {bt.lastMac === PI_MAC ? PI_NAME : bt.lastMac}
            </span>
            <button style={{
              background: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent,
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }} onClick={handleReconnect}>Reconnect</button>
          </div>
        )}

        {/* Connection */}
        {bt.status === 'connected' ? (
          <div style={card}>
            <div style={heading}>
              ✅ Connected
              {bt.isPi && <span style={{
                display: 'inline-block', background: theme.successLight, color: theme.success,
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, marginLeft: 6,
              }}>DOOR PI</span>}
            </div>
            <div style={{ fontSize: 13, color: theme.textSecondary }}>
              {bt.connectedDevice?.name || bt.connectedDevice?.address}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', marginTop: 2 }}>
              {bt.connectedDevice?.address}
            </div>
            {bt.rssi !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 0', marginTop: 8, borderTop: `1px solid ${theme.divider}`,
              }}>
                <div style={{ height: 6, borderRadius: 3, flex: 1, background: theme.divider, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, transition: 'width 0.5s, background 0.5s',
                    width: `${rssiPct(bt.rssi)}%`, background: rssiColor(bt.rssi),
                  }} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: bt.isNearby ? theme.successLight : theme.warningLight,
                  color: bt.isNearby ? theme.success : theme.warning,
                }}>{bt.rssi} dBm</span>
              </div>
            )}
            {bt.isNearby === false && (
              <div style={{ fontSize: 12, color: theme.warning, marginTop: 8 }}>
                📡 Move closer to register or delete faces
              </div>
            )}
            <button style={{ ...btnBase, background: theme.danger, color: '#fff', marginTop: 12 }}
              onClick={bt.disconnect}>Disconnect</button>
          </div>
        ) : (
          <div style={card}>
            <div style={heading}>Connect to Door Pi</div>
            <button style={{ ...btnBase, background: theme.accent, color: '#fff', marginBottom: 12 }}
              onClick={handleQuickConnect} disabled={bt.status === 'connecting'}>
              {bt.status === 'connecting' ? '⏳ Connecting...' : `🔗 Connect to ${PI_NAME}`}
            </button>
            {bt.error && <div style={{ color: theme.danger, fontSize: 13, marginTop: 8 }}>{bt.error}</div>}
            {devices.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={sub}>
                  Paired Devices
                  {devices.length > 3 && !showAll && (
                    <span onClick={() => setShowAll(true)}
                      style={{ color: theme.accent, cursor: 'pointer', fontSize: 12 }}>
                      {' '}(show all {devices.length})
                    </span>
                  )}
                </div>
                {(showAll ? devices : devices.slice(0, 3)).map((d) => (
                  <div key={d.address} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: `1px solid ${theme.divider}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
                        {d.name || 'Unknown'}
                        {d.address === PI_MAC && <span style={{
                          display: 'inline-block', background: theme.accentLight, color: theme.accentText,
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, marginLeft: 6,
                        }}>PI</span>}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', marginTop: 1 }}>
                        {d.address}
                      </div>
                    </div>
                    <button style={{
                      background: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent,
                      borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      flexShrink: 0,
                    }} onClick={() => bt.connect(d.address)}>Connect</button>
                  </div>
                ))}
              </div>
            )}
            <button style={{ ...btnBase, background: theme.cardAlt, color: theme.text, marginTop: 12 }}
              onClick={bt.listPaired}>🔄 Refresh Device List</button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        {bt.status === 'idle' && (
          <div style={{ marginTop: 16, fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>
            Turn on Bluetooth and pair with the Door Pi, then tap Connect.
          </div>
        )}
      </div>
    </div>
  );
}
