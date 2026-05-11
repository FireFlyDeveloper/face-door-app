import { useState, useCallback, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildList, buildDelete, type BTResponse } from '../services/protocol';
import { theme } from '../theme';

interface FaceItem {
  face_id: string; created_at: string; metadata?: Record<string, unknown>;
}
interface Props { onBack: () => void; bt: ReturnType<typeof useBluetooth> }

export default function FaceList({ onBack, bt }: Props) {
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { loadFaces(); }, [loadFaces]);

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

        {error && (
          <div style={{
            background: '#ffebee', color: theme.danger, fontSize: 13, padding: '10px 14px',
            borderRadius: 8, marginBottom: 12,
          }}>{error}</div>
        )}
        {success && (
          <div style={{
            background: '#e8f5e9', color: theme.success, fontSize: 13, padding: '10px 14px',
            borderRadius: 8, marginBottom: 12,
          }}>{success}</div>
        )}

        <div style={{
          background: theme.card, borderRadius: 14, padding: 20,
          boxShadow: theme.shadowCard, border: `1px solid ${theme.border}`,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>
              Registered Faces {faces.length > 0 && <span style={{ fontSize: 13, color: theme.textMuted }}>({faces.length}/5)</span>}
            </div>
            <button onClick={loadFaces} disabled={loading}
              style={{
                background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted,
                borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              }}>
              {loading ? '...' : '↻'}
            </button>
          </div>

          {loading && faces.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
              Loading faces...
            </div>
          )}

          {!loading && faces.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
              No faces registered yet.
            </div>
          )}

          {faces.map((face) => (
            <div key={face.face_id} style={{
              background: theme.cardAlt, borderRadius: 10, padding: 14, marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: `1px solid ${theme.border}`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: theme.text }}>{face.face_id}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  {face.created_at ? new Date(face.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
              {confirmDelete === face.face_id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setConfirmDelete(null)}
                    style={{
                      background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted,
                      borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}>Cancel</button>
                  <button onClick={() => handleDelete(face.face_id)} disabled={deleting === face.face_id}
                    style={{
                      background: theme.danger, border: 'none', color: '#fff',
                      borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>{deleting === face.face_id ? '...' : 'Delete'}</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(face.face_id)}
                  style={{
                    background: 'transparent', border: `1px solid ${theme.danger}`, color: theme.danger,
                    borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>Delete</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
