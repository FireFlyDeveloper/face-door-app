import React, { useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildList, buildDelete, type BTResponse } from '../services/protocol';
import { theme } from '../theme';

interface FaceItem {
  face_id: string; created_at: string; metadata?: Record<string, unknown>;
}
interface Props { onBack: () => void; bt: ReturnType<typeof useBluetooth> }

const card: React.CSSProperties = {
  background: theme.card, borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: theme.shadowCard,
};
const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 12, color: theme.accentText };
const btnBase: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 8, border: 'none',
  fontWeight: 600, fontSize: 15, cursor: 'pointer',
};

export default function FaceList({ onBack, bt }: Props) {
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadFaces = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const resp = (await bt.sendCommand(buildList())) as unknown as BTResponse;
      if (resp.status === 'OK' && resp.faces) setFaces(resp.faces);
      else setError(resp.message || 'Failed to load faces');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally { setLoading(false); }
  }, [bt]);

  const handleDelete = useCallback(async (faceId: string) => {
    setDeleting(faceId); setError(''); setSuccess('');
    try {
      const resp = (await bt.sendCommand(buildDelete(faceId))) as unknown as BTResponse;
      if (resp.status === 'OK') {
        setFaces((p) => p.filter((f) => f.face_id !== faceId));
        setSuccess(`Deleted "${faceId}"`);
      } else setError(resp.message || 'Delete failed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally { setDeleting(null); setConfirmDelete(null); }
  }, [bt]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <TopBar title="Manage Faces" onBack={onBack} />
      <div style={{ padding: 16 }}>
        {error && <div style={{ color: theme.danger, fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: theme.success, fontSize: 13, marginBottom: 8 }}>{success}</div>}

        <div style={card}>
          <div style={heading}>Registered Faces (max 5)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button style={{ ...btnBase, background: theme.accent, color: '#fff', flex: 1 }}
              onClick={loadFaces} disabled={loading}>
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
          {faces.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
              No faces registered yet.<br />Use "Register Face" to add faces.
            </div>
          )}
          {faces.map((face) => (
            <div key={face.face_id} style={{
              background: theme.cardAlt, borderRadius: 8, padding: 14, marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{face.face_id}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  {new Date(face.created_at).toLocaleDateString()}
                </div>
              </div>
              {confirmDelete === face.face_id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{
                    background: 'transparent', border: `1px solid ${theme.accent}`, color: theme.accent,
                    borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button style={{
                    background: theme.danger, border: 'none', color: '#fff',
                    borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }} onClick={() => handleDelete(face.face_id)} disabled={deleting === face.face_id}>
                    {deleting === face.face_id ? '...' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button style={{
                  background: 'transparent', border: `1px solid ${theme.danger}`, color: theme.danger,
                  borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }} onClick={() => setConfirmDelete(face.face_id)}>Delete</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
