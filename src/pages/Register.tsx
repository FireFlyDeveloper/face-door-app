import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/TopBar';
import CaptureGuide, { type CapturedImage } from '../components/CaptureGuide';
import { useBluetooth, RSSI_THRESHOLD } from '../hooks/useBluetooth';
import { buildRegisterImage, buildRegisterFinalize, type BTResponse } from '../services/protocol';
import { processImages } from '../services/imageProcessor';

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
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#16213e',
    color: '#e0e0e0',
    fontSize: 15,
    marginBottom: 12,
    boxSizing: 'border-box',
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
  progressBar: {
    height: 4,
    background: '#2a2a3e',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#64ffda',
    borderRadius: 2,
    transition: 'width 0.3s',
  },
  step: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
};

export default function Register({ onBack, bt }: Props) {
  const [step, setStep] = useState<'input' | 'capture' | 'processing' | 'done' | 'error'>('input');
  const [faceId, setFaceId] = useState('');
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  const handleCaptureComplete = useCallback((images: CapturedImage[]) => {
    setCapturedImages(images);
    setStep('processing');
  }, []);

  const handleRegister = useCallback(async () => {
    if (!faceId.trim()) {
      setError('Please enter a face name/ID');
      return;
    }
    // Proximity gate — re-check RSSI before capture
    if (bt.isNearby === false) {
      setError(`Move closer to the door (RSSI: ${bt.rssi} dBm, need ≥${RSSI_THRESHOLD})`);
      return;
    }
    setStep('capture');
  }, [faceId]);

  const handleSubmit = useCallback(async () => {
    if (capturedImages.length < 10) return;

    setProgress(10);
    setError('');
    setMessage('Processing images...');

    try {
      // Step 1: Process all images (compress, resize, base64)
      const files = capturedImages.map((c) => c.file);
      const processed = await processImages(files);
      setProgress(20);

      if (abortRef.current) return;

      // Step 2: Send each image one at a time over Bluetooth
      // Each image takes ~3-4s for Pi to ArcFace-encode, so sending one
      // at a time keeps each round trip short enough to avoid BT timeout.
      for (let i = 0; i < processed.length; i++) {
        if (abortRef.current) return;
        setMessage(`Sending image ${i + 1}/${processed.length}...`);
        setProgress(20 + Math.round((i / processed.length) * 60));

        const cmd = buildRegisterImage(faceId.trim(), processed[i].base64);
        const resp = (await bt.sendCommand(cmd)) as unknown as BTResponse;

        if (resp.status !== 'OK') {
          setError(resp.message || `Image ${i + 1} failed`);
          setStep('error');
          return;
        }
      }

      if (abortRef.current) return;

      // Step 3: Finalize — Pi averages all encodings and saves
      setMessage('Finalizing registration...');
      setProgress(85);
      const finalCmd = buildRegisterFinalize(faceId.trim());
      const finalResp = (await bt.sendCommand(finalCmd)) as unknown as BTResponse;

      setProgress(100);

      if (finalResp.status === 'OK') {
        setMessage(`✅ Face "${faceId}" registered successfully!`);
        setStep('done');
      } else {
        setError(finalResp.message || 'Finalization failed');
        setStep('error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      setStep('error');
    }
  }, [capturedImages, faceId, bt]);

  // Auto-submit when step transitions to processing with captured images
  useEffect(() => {
    if (step === 'processing' && capturedImages.length >= 10) {
      handleSubmit();
    }
  }, [step, capturedImages, handleSubmit]);

  const handleReset = useCallback(() => {
    setStep('input');
    setCapturedImages([]);
    setProgress(0);
    setMessage('');
    setError('');
    abortRef.current = false;
  }, []);

  return (
    <div style={styles.container}>
      <TopBar title="Register Face" onBack={step === 'input' ? onBack : undefined} />

      <div style={styles.content}>
        {/* Error display */}
        {error && (
          <div style={styles.card}>
            <div style={styles.error}>{error}</div>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary, marginTop: 12 }}
              onClick={handleReset}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Step 1: Enter face ID */}
        {step === 'input' && (
          <div style={styles.card}>
            <div style={styles.heading}>Face Name / ID</div>
            <input
              style={styles.input}
              placeholder="e.g. Alice, User_1, or John_Doe"
              value={faceId}
              onChange={(e) => setFaceId(e.target.value)}
              maxLength={50}
            />
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              Enter a unique name for this person. Max 5 faces total on the Pi.
            </div>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleRegister}
              disabled={!faceId.trim()}
            >
              Start Capture
            </button>
          </div>
        )}

        {/* Step 2: Capture 10 images */}
        {step === 'capture' && (
          <div>
            <div style={{ ...styles.card, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#64ffda', marginBottom: 8 }}>
                📷 Capture 10 Face Angles — {faceId}
              </div>
            </div>
            <CaptureGuide onComplete={handleCaptureComplete} />
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div style={styles.card}>
            <div style={styles.heading}>Registering Face...</div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <div style={styles.step}>{message}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              Do not close this screen or disconnect Bluetooth.
            </div>
            {progress === 10 && (
              <button
                style={{ ...styles.btn, ...styles.btnSecondary, marginTop: 12 }}
                onClick={() => { abortRef.current = true; handleReset(); }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div style={styles.card}>
            <div style={styles.success}>{message}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              The Pi now recognizes {faceId}. Stand in front of the camera to test.
            </div>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 16 }}
              onClick={handleReset}
            >
              Register Another Face
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary, marginTop: 8 }}
              onClick={onBack}
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
