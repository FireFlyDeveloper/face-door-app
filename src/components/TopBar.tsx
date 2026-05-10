import { theme } from '../theme';

interface TopBarProps {
  title: string;
  onBack?: () => void;
}

export default function TopBar({ title, onBack }: TopBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 16px',
      background: theme.headerBg, color: theme.headerText,
      minHeight: 56, boxShadow: theme.shadow,
      borderBottom: `1px solid ${theme.border}`,
    }}>
      {onBack && (
        <button style={{
          background: 'transparent', border: 'none', color: theme.accent,
          fontSize: 20, cursor: 'pointer', padding: '4px 12px 4px 0',
          fontWeight: 'bold',
        }} onClick={onBack} aria-label="Back">
          ←
        </button>
      )}
      <span style={{ fontSize: 18, fontWeight: 600, flex: 1 }}>{title}</span>
    </div>
  );
}
