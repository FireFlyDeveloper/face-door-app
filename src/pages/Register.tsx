import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/TopBar';
import CaptureGuide, { type CapturedImage } from '../components/CaptureGuide';
import { useBluetooth, RSSI_THRESHOLD } from '../hooks/useBluetooth';
import { buildRegister, type BTResponse } from '../services/protocol';
import { theme } from '../theme';

interface Props {
  onBack: () => void;
  bt: ReturnType<typeof useBluetooth>;
}

const C: React.CSSProperties = {
  maxWidth: 480, margin: '0 auto', minHeight: '100vh',
  background: theme.bg, color: theme.text,
};
const card: React.CSSProperties = {
  background: theme.card, borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: theme.shadowCard,
};
const heading: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 12, color: theme.accentText };
const input: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${theme.inputBorder}`,
  background: theme.inputBg, color: theme.text, fontSize: 15, marginBottom: 12, boxSizing: 'border-box',
};
const btnBase: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 8, border: 'none',
  fontWeight: 600, fontSize: 15, cursor: 'pointer',
};
const btnP: React.CSSProperties = { ...btnBase, background: theme.accent, color: '#fff' };
const btnS: React.CSSProperties = { ...btnBase, background: theme.cardAlt, color: theme.text };
const barBase: React.CSSProperties = {
  height: 4, background: theme.divider, borderRadius: 2, marginTop: 12, overflow: 'hidden',
};
const fillBase: React.CSSProperties = {
  height: '100%', background: theme.accent, borderRadius: 2, transition: 'width 0.3s',
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
    if (!faceId.trim()) { setError('Please enter a face name/ID'); return; }
    if (bt.isNearby === false) {
      setError(`Move closer to the door (RSSI: ${bt.rssi} dBm, need ≥${RSSI_THRESHOLD})`);
      return;
    }
    setStep('capture');
  }, [faceId, bt]);

  const handleSubmit = useCallback(async () => {
    if (capturedImages.length < 10) return;
    setProgress(10); setError(''); setMessage('Sending to Pi via Bluetooth...');
    try {
      const base64Images = capturedImages.map((c) => c.base64);
      const cmd = buildRegister(faceId.trim(), base64Images);
      setProgress(60);
      if (abortRef.current) return;
      const response = (await bt.sendCommand(cmd)) as unknown as BTResponse;
      setProgress(100);
      if (response.status === 'OK') {
        setMessage(`✅ Face "${faceId}" registered successfully!`);
        setStep('done');
      } else {
        setError(response.message || 'Registration failed');
        setStep('error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg); setStep('error');
    }
  }, [capturedImages, faceId, bt]);

  useEffect(() => {
    if (step === 'processing' && capturedImages.length >= 10) handleSubmit();
  }, [step, capturedImages, handleSubmit]);

  const handleReset = useCallback(() => {
    setStep('input'); setCapturedImages([]); setProgress(0); setMessage(''); setError('');
    abortRef.current = false;
  }, []);

  return (
    <div style={C}>
      <TopBar title="Register Face" onBack={step === 'input' ? onBack : undefined} />
      <div style={{ padding: 16 }}>
        {error && (
          <div style={card}>
            <div style={{ color: theme.danger, fontSize: 13 }}>{error}</div>
            <button style={{ ...btnS, marginTop: 12 }} onClick={handleReset}>Try Again</button>
          </div>
        )}

        {step === 'input' && (
          <div style={card}>
            <div style={heading}>Face Name / ID</div>
            <input style={input} placeholder="e.g. Alice, User_1, or John_Doe"
              value={faceId} onChange={(e) => setFaceId(e.target.value)} maxLength={50} />
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>
              Enter a unique name. Max 5 faces total on the Pi.
            </div>
            <button style={btnP} onClick={handleRegister} disabled={!faceId.trim()}>
              📸 Start Manual Capture
            </button>
          </div>
        )}

        {step === 'capture' && (
          <div>
            <div style={{ ...card, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.accentText, marginBottom: 8 }}>
                📷 Tap the button to capture each of the 10 angles for {faceId}
              </div>
            </div>
            <CaptureGuide onComplete={handleCaptureComplete} sendCommand={bt.sendCommand} />
          </div>
        )}

        {step === 'processing' && (
          <div style={card}>
            <div style={heading}>Registering Face...</div>
            <div style={barBase}><div style={{ ...fillBase, width: `${progress}%` }} /></div>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>{message}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>
              Do not close this screen or disconnect Bluetooth.
            </div>
            {progress === 10 && (
              <button style={btnS} onClick={() => { abortRef.current = true; handleReset(); }}>
                Cancel
              </button>
            )}
          </div>
        )}

        {step === 'done' && (
          <div style={card}>
            <div style={{ color: theme.success, fontSize: 14, fontWeight: 600 }}>{message}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8 }}>
              The Pi now recognizes {faceId}. Stand in front of the camera to test.
            </div>
            <button style={{ ...btnP, marginTop: 16 }} onClick={handleReset}>
              Register Another Face
            </button>
            <button style={{ ...btnS, marginTop: 8 }} onClick={onBack}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
