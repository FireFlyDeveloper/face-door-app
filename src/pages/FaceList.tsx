import React, { useState, useCallback } from 'react';
import TopBar from '../components/TopBar';
import { useBluetooth } from '../hooks/useBluetooth';
import { buildList, buildDelete, type BTResponse } from '../services/protocol';

interface FaceItem {
  face_id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
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
  btnDanger: {
    background: '#ff1744',
    color: '#fff',
  },
  btnSecondary: {
    background: '#2a2a3e',
    color: '#e0e0e0',
  },
  error: {
    color: '#ff1744',
    fontSize: 13,
    marginTop: 8,
  },
  success: {
    color: '#00e676',
    fontSize: 13,
    marginTop: 8,
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: '#666',
    fontSize: 14,
  },
  faceItem: {
    background: '#16213e',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faceName: {
    fontWeight: 600,
    fontSize: 15,
  },
  faceDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid #ff1744',
    color: '#ff1744',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  confirmBox: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
};

export default function FaceList({ onBack, bt }: Props) {
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadFaces = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = (await bt.sendCommand(buildList())) as unknown as BTResponse;
      if (response.status === 'OK' && response.faces) {
        setFaces(response.faces);
      } else {
        setError(response.message || 'Failed to load faces');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [bt]);

  const handleDelete = useCallback(async (faceId: string) => {
    setDeleting(faceId);
    setError('');
    setSuccess('');
    try {
      const response = (await bt.sendCommand(buildDelete(faceId))) as unknown as BTResponse;
      if (response.status === 'OK') {
        setFaces((prev) => prev.filter((f) => f.face_id !== faceId));
        setSuccess(`Deleted "${faceId}"`);
      } else {
        setError(response.message || 'Delete failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setError(msg);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }, [bt]);

  return (
    <div style={styles.container}>
      <TopBar title="Manage Faces" onBack={onBack} />

      <div style={styles.content}>
        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.card}>
          <div style={styles.heading}>Registered Faces (max 5)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, width: 'auto', flex: 1 }}
              onClick={loadFaces}
              disabled={loading}
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {faces.length === 0 && !loading ? (
            <div style={styles.emptyState}>
              No faces registered yet.
              <br />
              Use "Register Face" to add faces.
            </div>
          ) : (
            faces.map((face) => (
              <div key={face.face_id} style={styles.faceItem}>
                <div>
                  <div style={styles.faceName}>{face.face_id}</div>
                  <div style={styles.faceDate}>
                    Registered: {new Date(face.created_at).toLocaleDateString()}
                  </div>
                </div>
                {confirmDelete === face.face_id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      style={{ ...styles.deleteBtn, borderColor: '#00e676', color: '#00e676' }}
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(face.face_id)}
                      disabled={deleting === face.face_id}
                    >
                      {deleting === face.face_id ? '...' : 'Confirm'}
                    </button>
                  </div>
                ) : (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => setConfirmDelete(face.face_id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
