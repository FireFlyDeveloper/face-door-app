import React, { useRef, useState, useCallback } from 'react';

// 10 capture positions with guide descriptions
const CAPTURE_POSITIONS = [
  { id: 0, label: 'Front', desc: 'Look straight at camera' },
  { id: 1, label: 'Front-Left', desc: 'Turn head slightly left' },
  { id: 2, label: 'Front-Right', desc: 'Turn head slightly right' },
  { id: 3, label: 'Up', desc: 'Tilt head up slightly' },
  { id: 4, label: 'Down', desc: 'Tilt head down slightly' },
  { id: 5, label: 'Left-Profile', desc: 'Turn head ~45° left' },
  { id: 6, label: 'Right-Profile', desc: 'Turn head ~45° right' },
  { id: 7, label: 'Top-Left', desc: 'Look up-left' },
  { id: 8, label: 'Top-Right', desc: 'Look up-right' },
  { id: 9, label: 'Close-Up', desc: 'Move closer to camera' },
] as const;

interface CapturedImage {
  position: number;
  label: string;
  file: File;
  previewUrl: string;
}

interface Props {
  onComplete: (images: CapturedImage[]) => void;
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
  },
  video: {
    width: '100%',
    display: 'block',
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
  },
  thumbnailActive: {
    width: 48,
    height: 48,
    borderRadius: 6,
    objectFit: 'cover',
    border: '2px solid #64ffda',
  },
  hiddenInput: {
    display: 'none',
  },
};

export default function CaptureGuide({ onComplete }: Props) {
  const [currentPos, setCurrentPos] = useState(0);
  const [captured, setCaptured] = useState<CapturedImage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const position = CAPTURE_POSITIONS[currentPos];
  const isComplete = currentPos >= CAPTURE_POSITIONS.length;

  const handleCaptureClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newCapture: CapturedImage = {
      position: position.id,
      label: position.label,
      file,
      previewUrl: URL.createObjectURL(file),
    };

    const updated = [...captured, newCapture];
    setCaptured(updated);
    setCurrentPos((p) => p + 1);

    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  }, [captured, position]);

  const handleRetake = useCallback((posIndex: number) => {
    setCaptured((prev) => prev.filter((c) => c.position !== posIndex));
    setCurrentPos(posIndex);
  }, []);

  // All 10 captured — notify parent
  if (isComplete && captured.length >= 10) {
    onComplete(captured);
    return null;
  }

  return (
    <div>
      <div style={styles.container}>
        {/* Hidden camera input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={styles.hiddenInput}
          onChange={handleFileCapture}
        />

        {/* Dark placeholder (camera viewfinder substitute) */}
        <div style={{ width: '100%', aspectRatio: '3/4', background: '#111' }} />

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
        <div style={styles.progress}>{captured.length}/10 captured</div>

        {/* Capture button */}
        <button style={styles.captureBtn} onClick={handleCaptureClick} aria-label="Capture" />

        {/* Retake last */}
        {captured.length > 0 && (
          <button
            style={styles.retakeBtn}
            onClick={() => handleRetake(captured[captured.length - 1].position)}
          >
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
              />
            ) : (
              <div
                key={pos.id}
                style={{
                  ...styles.thumbnail,
                  background: '#222',
                  border: '2px solid #333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#555',
                  fontSize: 10,
                }}
              >
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
