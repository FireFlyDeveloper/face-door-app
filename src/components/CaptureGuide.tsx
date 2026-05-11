import React, { useRef, useState, useCallback, useEffect } from 'react';

// 10 capture positions with guide descriptions
const CAPTURE_POSITIONS = [
  { id: 0, label: 'Front', desc: 'Look straight at Pi camera' },
  { id: 1, label: 'Front-Left', desc: 'Turn head slightly left' },
  { id: 2, label: 'Front-Right', desc: 'Turn head slightly right' },
  { id: 3, label: 'Up', desc: 'Tilt head up slightly' },
  { id: 4, label: 'Down', desc: 'Tilt head down slightly' },
  { id: 5, label: 'Left-Profile', desc: 'Turn head ~45° left' },
  { id: 6, label: 'Right-Profile', desc: 'Turn head ~45° right' },
  { id: 7, label: 'Top-Left', desc: 'Look up-left' },
  { id: 8, label: 'Top-Right', desc: 'Look up-right' },
  { id: 9, label: 'Close-Up', desc: 'Move closer to Pi camera' },
] as const;

const POLL_INTERVAL = 200; // ms between frame requests

interface CapturedImage {
  position: number;
  label: string;
  base64: string;
  previewUrl: string;
}

interface Props {
  onComplete: (images: CapturedImage[]) => void;
  sendCommand: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: '4/3',
  },
  img: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'contain',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  guideFrame: {
    width: '70%',
    maxWidth: 280,
    aspectRatio: '3/4',
    border: '2px dashed rgba(100, 255, 218, 0.6)',
    borderRadius: 16,
  },
  positionLabel: {
    position: 'absolute',
    bottom: 80,
    left: 0, right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: 700,
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  },
  positionDesc: {
    position: 'absolute',
    bottom: 56,
    left: 0, right: 0,
    textAlign: 'center',
    color: '#b0b0b0',
    fontSize: 14,
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  },
  progress: {
    position: 'absolute',
    top: 12,
    left: 12,
    background: 'rgba(0,0,0,0.6)',
    color: '#64ffda',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  captureBtn: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 56,
    height: 56,
    borderRadius: 28,
    background: '#fff',
    border: '4px solid #64ffda',
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    background: 'rgba(255,23,68,0.8)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  thumbnails: {
    display: 'flex',
    gap: 4,
    padding: 8,
    overflowX: 'auto',
    background: '#0f0f1a',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: 'cover',
    border: '2px solid transparent',
    cursor: 'pointer',
  },
  thumbnailActive: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: 'cover',
    border: '2px solid #64ffda',
    cursor: 'pointer',
  },
  emptyThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    background: '#222',
    border: '2px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555',
    fontSize: 10,
    flexShrink: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64ffda',
    fontSize: 14,
  },
  error: {
    padding: 20,
    textAlign: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: '#ff1744',
    marginBottom: 12,
  },
  mutedText: {
    fontSize: 13,
    color: '#78909c',
  },
};

export default function CaptureGuide({ onComplete, sendCommand }: Props) {
  const [currentPos, setCurrentPos] = useState(0);
  const [captured, setCaptured] = useState<CapturedImage[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [streamError, setStreamError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const position = CAPTURE_POSITIONS[currentPos];
  const isComplete = currentPos >= CAPTURE_POSITIONS.length;

  // ── Poll Pi camera frames ──
  const fetchFrame = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const resp = await sendCommand({ action: 'GET_FRAME' }) as Record<string, unknown>;
      if (!mountedRef.current) return;
      if (resp?.status === 'OK') {
        const b64 = resp.frame as string;
        const url = `data:image/jpeg;base64,${b64}`;
        setPreview(url);
        setStreaming(true);
        setStreamError('');
      } else {
        setStreamError('No frame from Pi');
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setStreamError(err instanceof Error ? err.message : 'Connection lost');
        setStreaming(false);
      }
    }
  }, [sendCommand]);

  // Start polling on mount
  useEffect(() => {
    mountedRef.current = true;
    // Kick off first frame
    fetchFrame();
    // Continuous polling
    const poll = () => {
      pollingRef.current = setTimeout(async () => {
        await fetchFrame();
        if (mountedRef.current) poll();
      }, POLL_INTERVAL);
    };
    poll();
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [fetchFrame]);

  const handleCaptureClick = useCallback(async () => {
    if (capturing || !preview) return;
    setCapturing(true);

    try {
      // Request a fresh frame specifically for capture (not the polled preview)
      const resp = await sendCommand({ action: 'GET_FRAME' }) as Record<string, unknown>;
      if (resp?.status !== 'OK' || !resp.frame) {
        throw new Error('Failed to capture from Pi');
      }

      const b64 = resp.frame as string;
      const url = `data:image/jpeg;base64,${b64}`;

      const newCapture: CapturedImage = {
        position: position.id,
        label: position.label,
        base64: b64,
        previewUrl: url,
      };

      const updated = [...captured, newCapture];
      setCaptured(updated);
      setCurrentPos((p) => p + 1);

      // All 10 done
      if (updated.length >= CAPTURE_POSITIONS.length) {
        onComplete(updated);
      }
    } catch (err: unknown) {
      setStreamError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setCapturing(false);
    }
  }, [capturing, preview, captured, position, sendCommand, onComplete]);

  const handleRetake = useCallback((posIndex: number) => {
    setCaptured((prev) => prev.filter((c) => c.position !== posIndex));
    setCurrentPos(posIndex);
  }, []);

  // ── Error screen ──
  if (streamError && !preview) {
    return (
      <div style={styles.error}>
        <div style={styles.errorText}>⚠️ {streamError}</div>
        <div style={styles.mutedText}>Make sure the Pi is running and you're connected via Bluetooth.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.container}>
        {preview ? (
          <img src={preview} alt="Pi Camera" style={styles.img} />
        ) : (
          <div style={styles.loading}>Connecting to Pi camera...</div>
        )}

        {/* Guide overlay */}
        <div style={styles.overlay}>
          <div style={styles.guideFrame} />
        </div>

        {/* Position label */}
        <div style={styles.positionLabel}>
          {captured.length + 1}. {position.label}
        </div>
        <div style={styles.positionDesc}>{position.desc}</div>

        {/* Progress */}
        <div style={styles.progress}>{captured.length}/{CAPTURE_POSITIONS.length} captured</div>

        {/* Capture button */}
        <button
          style={{
            ...styles.captureBtn,
            opacity: preview && !capturing ? 1 : 0.4,
          }}
          onClick={handleCaptureClick}
          disabled={!preview || capturing}
          aria-label="Capture"
        />

        {/* Retake last */}
        {captured.length > 0 && (
          <button style={styles.retakeBtn} onClick={() => handleRetake(captured[captured.length - 1].position)}>
            Retake
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {captured.length > 0 && (
        <div style={styles.thumbnails}>
          {CAPTURE_POSITIONS.map((pos) => {
            const cap = captured.find((c) => c.position === pos.id);
            return cap ? (
              <img
                key={pos.id}
                src={cap.previewUrl}
                alt={pos.label}
                style={pos.id === currentPos ? styles.thumbnailActive : styles.thumbnail}
                onClick={() => handleRetake(pos.id)}
              />
            ) : (
              <div key={pos.id} style={styles.emptyThumb}>
                {pos.label.slice(0, 2)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { CAPTURE_POSITIONS };
export type { CapturedImage };
