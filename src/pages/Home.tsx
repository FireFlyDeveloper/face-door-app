import TopBar from '../components/TopBar';
import { type UseBluetoothReturn } from '../hooks/useBluetooth';
import { theme } from '../theme';

type Page = 'home' | 'register' | 'faces' | 'log';
interface HomeProps { onNavigate: (page: Page) => void; bt: UseBluetoothReturn }

function rssiPct(rssi: number): number {
  return Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
}

const CARD: React.CSSProperties = {
  background: theme.card, borderRadius: 14, padding: 20,
  boxShadow: theme.shadowCard,
};

export default function Home({ onNavigate, bt }: HomeProps) {

  // Auto-RSSI polling handled inside useBluetooth now

  const devName = bt.connectedDevice?.name || bt.connectedDevice?.address;
  const nearbyOk = bt.status === 'connected' && bt.isNearby !== false;

  // ── Action buttons ────────────────────────────────────────────────────
  function Action({ icon, title, desc, page, disabled }: {
    icon: string; title: string; desc: string; page: Page; disabled?: boolean;
  }) {
    return (
      <button onClick={() => onNavigate(page)} disabled={disabled}
        style={{
          ...CARD, cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left', border: `1px solid ${disabled ? '#eee' : theme.border}`,
          opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 14,
          padding: 16, width: '100%',
        }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: disabled ? '#f0f0f0' : '#e0f7f3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{title}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{desc}</div>
        </div>
        <div style={{ color: theme.textMuted, fontSize: 18 }}>›</div>
      </button>
    );
  }

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', minHeight: '100vh',
      background: theme.bg, color: theme.text,
    }}>
      <TopBar title="Face Door" />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Status Card ─────────────────────────────────────────────── */}
        <div style={{
          ...CARD, border: `1px solid ${theme.border}`,
          background: bt.status === 'connected'
            ? 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 100%)'
            : bt.status === 'connecting'
              ? 'linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%)'
              : bt.status === 'error'
                ? 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)'
                : theme.card,
        }}>
          {/* Top row: icon + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24,
              background: bt.status === 'connected' ? '#00c853' :
                bt.status === 'connecting' ? '#ff8f00' : '#bdbdbd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff',
              boxShadow: bt.status === 'connected'
                ? '0 0 0 4px rgba(0,200,83,0.2)' : 'none',
              transition: 'all 0.3s',
            }}>
              {bt.status === 'connected' ? '✓' :
               bt.status === 'connecting' ? '⏳' : '✕'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                {bt.status === 'connected' ? 'Connected' :
                 bt.status === 'connecting' ? 'Connecting...' :
                 bt.status === 'error' ? 'Disconnected' : 'Offline'}
              </div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 1 }}>
                {bt.status === 'connected' ? devName :
                 bt.status === 'connecting' ? 'Connecting to Pi...' :
                 bt.status === 'error' ? bt.error || 'Connection lost' :
                 'Enable Bluetooth'}
              </div>
            </div>
            {bt.status === 'connected' && (
              <button onClick={bt.disconnect}
                style={{
                  background: 'rgba(229,57,53,0.1)', border: 'none', color: theme.danger,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}>Disconnect</button>
            )}
          </div>

          {/* RSSI bar */}
          {bt.status === 'connected' && bt.rssi !== null && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 11, color: theme.textMuted }}>Signal</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: bt.isNearby ? theme.success : theme.warning,
                }}>{bt.rssi} dBm</span>
              </div>
              <div style={{
                height: 6, borderRadius: 3, background: '#e0e0e0', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3, transition: 'width 0.5s',
                  width: `${rssiPct(bt.rssi)}%`,
                  background: bt.isNearby
                    ? 'linear-gradient(90deg, #00c853, #64ffda)'
                    : 'linear-gradient(90deg, #ff8f00, #ffd740)',
                }} />
              </div>
              {!bt.isNearby && bt.rssi !== null && (
                <div style={{ fontSize: 11, color: theme.warning, marginTop: 4 }}>
                  📡 Move closer to the door
                </div>
              )}
            </div>
          )}

          {/* Retry button on error */}
          {bt.status === 'error' && bt.lastMac && (
            <button onClick={() => bt.connect(bt.lastMac!)}
              style={{
                marginTop: 10, width: '100%', padding: 10, borderRadius: 10,
                border: 'none', background: theme.accent, color: '#fff',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>
              Retry Connection
            </button>
          )}
        </div>

        {/* ── Action Grid ─────────────────────────────────────────────── */}
        <Action icon="📷" title="Register Face"
          desc="Auto-capture 10 angles via camera"
          page="register" disabled={!nearbyOk} />

        <Action icon="👤" title="Manage Faces"
          desc="View, add, or delete registered faces"
          page="faces" disabled={!nearbyOk} />

        <Action icon="📋" title="Activity Log"
          desc="Pull door access history from Pi"
          page="log" disabled={bt.status !== 'connected'} />

        {/* ── Quick Status Tiles ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            ...CARD, flex: 1, textAlign: 'center', padding: '14px 10px',
            border: `1px solid ${theme.border}`,
          }}>
            <div style={{ fontSize: 24, marginBottom: 2 }}>📱</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Protocol</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.accentText }}>
              RFCOMM SPP
            </div>
          </div>
          <div style={{
            ...CARD, flex: 1, textAlign: 'center', padding: '14px 10px',
            border: `1px solid ${theme.border}`,
          }}>
            <div style={{ fontSize: 24, marginBottom: 2 }}>🔒</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Security</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.accentText }}>
              Face + Liveness
            </div>
          </div>
          <div style={{
            ...CARD, flex: 1, textAlign: 'center', padding: '14px 10px',
            border: `1px solid ${theme.border}`,
          }}>
            <div style={{ fontSize: 24, marginBottom: 2 }}>⚡</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Pi Status</div>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: bt.status === 'connected' ? theme.success : theme.textMuted,
            }}>
              {bt.status === 'connected' ? 'Online' : '—'}
            </div>
          </div>
        </div>

        {/* ── Info Footer ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', padding: '8px 0 20px', fontSize: 11, color: theme.textMuted }}>
          Face Door System v1.0 — Pair with your Pi via Bluetooth first
        </div>
      </div>
    </div>
  );
}
