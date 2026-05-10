/**
 * AutoCaptureGuide — iPhone Face ID-style face tracking with auto-capture.
 *
 * Uses TensorFlow.js + face-landmarks-detection to read face orientation
 * from the live camera. Guides the user through 10 positions and captures
 * automatically when the face matches the target orientation.
 *
 * UI: Circular face outline, progress ring, position dots, smooth guidance.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useState, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// ── 10 capture positions ────────────────────────────────────────────────
interface PositionTarget {
  id: number;
  label: string;
  yawTarget: number;
  pitchTarget: number;
  closeUp: boolean;
}

const CAPTURE_POSITIONS: PositionTarget[] = [
  { id: 0,  label: 'Center',       yawTarget: 0,   pitchTarget: 0,   closeUp: false },
  { id: 1,  label: 'Left',         yawTarget: -15, pitchTarget: 0,   closeUp: false },
  { id: 2,  label: 'Right',        yawTarget: 15,  pitchTarget: 0,   closeUp: false },
  { id: 3,  label: 'Far Left',     yawTarget: -35, pitchTarget: 0,   closeUp: false },
  { id: 4,  label: 'Far Right',    yawTarget: 35,  pitchTarget: 0,   closeUp: false },
  { id: 5,  label: 'Up',           yawTarget: 0,   pitchTarget: -12, closeUp: false },
  { id: 6,  label: 'Down',         yawTarget: 0,   pitchTarget: 12,  closeUp: false },
  { id: 7,  label: 'Up Left',      yawTarget: -15, pitchTarget: -10, closeUp: false },
  { id: 8,  label: 'Up Right',     yawTarget: 15,  pitchTarget: -10, closeUp: false },
  { id: 9,  label: 'Close',        yawTarget: 0,   pitchTarget: 0,   closeUp: true },
];

const YAW_THRESHOLD = 14;
const PITCH_THRESHOLD = 9;
const STABLE_FRAMES = 8;
const CLOSEUP_FACE_RATIO = 0.35;

const LM_NOSE_TIP = 1;
const LM_LEFT_EYE = 33;
const LM_RIGHT_EYE = 263;
const LM_FOREHEAD = 10;
const LM_CHIN = 152;

// ── Head pose estimation ────────────────────────────────────────────────
function estimatePose(
  landmarks: Array<{ x: number; y: number; z?: number }>,
  videoWidth: number,
): { yaw: number; pitch: number; faceRatio: number } {
  const nose = landmarks[LM_NOSE_TIP];
  const lEye = landmarks[LM_LEFT_EYE];
  const rEye = landmarks[LM_RIGHT_EYE];
  const forehead = landmarks[LM_FOREHEAD];
  const chin = landmarks[LM_CHIN];

  const faceW = Math.abs(rEye.x - lEye.x);
  const faceCx = (lEye.x + rEye.x) / 2;
  const faceH = Math.abs(chin.y - forehead.y);
  const faceCy = (chin.y + forehead.y) / 2;

  const yaw = faceW > 0 ? ((nose.x - faceCx) / faceW) * 90 : 0;
  const pitch = faceH > 0 ? ((nose.y - faceCy) / faceH) * 60 : 0;
  const faceRatio = videoWidth > 0 ? faceW / videoWidth : 0;

  return { yaw, pitch, faceRatio };
}

// ── Components ──────────────────────────────────────────────────────────

interface CapturedImage {
  position: number;
  label: string;
  file: File;
  previewUrl: string;
}

interface Props {
  onComplete: (images: CapturedImage[]) => void;
  onCancel: () => void;
}

/** Circular progress ring using SVG */
function ProgressRing({ progress }: { progress: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - progress * circ;
  return (
    <svg width={90} height={90} viewBox="0 0 90 90" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
      {/* Background ring */}
      <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
      {/* Progress arc */}
      <circle cx={45} cy={45} r={r} fill="none" stroke="#64ffda" strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      {/* Percentage text */}
      <text x={45} y={49} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={700}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

/** Position dot indicators around the face outline */
function PositionDots({ currentPos, capturedSet }: { currentPos: number; capturedSet: Set<number> }) {
  const count = CAPTURE_POSITIONS.length;
  // Spread dots at slightly different angles for visual variety
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {CAPTURE_POSITIONS.map((p, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const radius = 140; // px from center
        const done = capturedSet.has(p.id);
        const active = i === currentPos;
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px - 7px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px - 7px)`,
            width: 14, height: 14, borderRadius: 7,
            background: done ? '#64ffda' : active ? '#ffab00' : 'rgba(255,255,255,0.25)',
            boxShadow: done || active ? `0 0 8px ${done ? '#64ffda' : '#ffab00'}` : 'none',
            transition: 'all 0.3s ease',
            zIndex: active ? 5 : 1,
          }} />
        );
      })}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function AutoCaptureGuide({ onComplete, onCancel }: Props) {
  const [captured, setCaptured] = useState<CapturedImage[]>([]);
  const [currentPos, setCurrentPos] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [phase, setPhase] = useState<'align' | 'capturing' | 'done'>('align');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const frameRef = useRef<number>(0);
  const stableRef = useRef(0);
  const posRef = useRef(0);
  const capturedRef = useRef<CapturedImage[]>([]);
  const runningRef = useRef(true);
  const pulseRef = useRef(0);

  const pos = CAPTURE_POSITIONS[currentPos];
  const isComplete = currentPos >= CAPTURE_POSITIONS.length;
  const progress = captured.length / CAPTURE_POSITIONS.length;
  const capturedSet = new Set(captured.map((c) => c.position));

  // ── Phase 1: Load model ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        const faceLandmarks = await import('@tensorflow-models/face-landmarks-detection');
        const model = faceLandmarks.SupportedModels.MediaPipeFaceMesh;
        const detector = await faceLandmarks.createDetector(model, {
          runtime: 'tfjs',
          refineLandmarks: true,
        });
        if (cancelled) return;
        modelRef.current = detector;
        setLoaded(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load face model');
        }
      }
    }
    loadModel();
    return () => { cancelled = true; };
  }, []);

  // ── Phase 2: Start camera ─────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch { /* ok */ }
        }
        if (typeof modelRef.current?.estimateFaces !== 'function') {
          setError('Model error');
          return;
        }
        processFrame();
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Camera failed');
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      runningRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [loaded]);

  // ── Frame processing ──────────────────────────────────────────────────
  const processFrame = useCallback(async () => {
    if (!runningRef.current || !modelRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) {
      frameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 640;
      ctx.drawImage(video, 0, 0);

      const faces = await modelRef.current.estimateFaces(canvas);
      const hasFace = faces && faces.length > 0;
      setFaceDetected(hasFace);

      if (hasFace && faces[0].keypoints && faces[0].keypoints.length > 200) {
        const { yaw: y, pitch: p, faceRatio } = estimatePose(faces[0].keypoints, video.videoWidth);
        setYaw(y);
        setPitch(p);

        const target = CAPTURE_POSITIONS[posRef.current];
        if (!target) return;

        const closeUpMet = !target.closeUp || faceRatio >= CLOSEUP_FACE_RATIO;
        const yawMatch = Math.abs(y - target.yawTarget) <= YAW_THRESHOLD;
        const pitchMatch = Math.abs(p - target.pitchTarget) <= PITCH_THRESHOLD;

        if (yawMatch && pitchMatch && closeUpMet) {
          setPhase('capturing');
          stableRef.current += 1;

          if (stableRef.current >= STABLE_FRAMES) {
            stableRef.current = 0;

            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            const cctx = captureCanvas.getContext('2d')!;
            cctx.drawImage(video, 0, 0);

            const blob = await new Promise<Blob | null>((res) =>
              captureCanvas.toBlob(res, 'image/jpeg', 0.6),
            );
            if (!blob) return;

            const file = new File([blob], `face_${target.id}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);

            const newImg: CapturedImage = {
              position: target.id, label: target.label, file, previewUrl,
            };
            const updated = [...capturedRef.current, newImg];
            capturedRef.current = updated;
            setCaptured(updated);

            const nextPos = posRef.current + 1;
            posRef.current = nextPos;
            setCurrentPos(nextPos);
            setPhase('align');

            if (nextPos >= CAPTURE_POSITIONS.length) {
              runningRef.current = false;
              setPhase('done');
              setTimeout(() => onComplete(updated), 600);
              return;
            }
          }
        } else {
          stableRef.current = 0;
        }
      } else {
        stableRef.current = 0;
      }
    } catch {
      console.warn('[FaceDetect] estimateFaces failed');
    }

    frameRef.current = requestAnimationFrame(processFrame);
  }, [onComplete]);

  // ── Pulse animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'capturing') return;
    let id: number;
    const animate = () => {
      pulseRef.current = Math.sin(Date.now() / 200) * 0.15 + 0.85;
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: '#ff1744', marginBottom: 12 }}>⚠️ {error}</div>
        <button onClick={onCancel} style={{
          background: '#64ffda', color: '#0f0f1a', border: 'none',
          borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer',
        }}>Back</button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={{
        textAlign: 'center', padding: 60, color: '#00bfa5',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, border: '3px solid rgba(0,191,165,0.3)',
          borderTopColor: '#00bfa5', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div>Preparing Face ID</div>
      </div>
    );
  }

  if (phase === 'done' || isComplete) return null;

  const yawMatch = Math.abs(yaw - pos.yawTarget) <= YAW_THRESHOLD;
  const pitchMatch = Math.abs(pitch - pos.pitchTarget) <= PITCH_THRESHOLD;
  const aligned = yawMatch && pitchMatch;
  const pulse = phase === 'capturing' ? pulseRef.current || 1 : 1;

  return (
    <div style={{ position: 'relative' }}>
      {/* Camera container */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480, height: 440, margin: '0 auto',
        background: '#000', borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Camera feed */}
        <video ref={videoRef} autoPlay playsInline muted style={{
          width: '100%', height: '100%', display: 'block', objectFit: 'cover',
          transform: 'scaleX(-1)',
        }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Dark vignette overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Face outline ring */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 240, height: 320,
          transform: `translate(-50%, -50%) scale(${pulse})`,
          transition: 'transform 0.1s ease-out',
          pointerEvents: 'none',
        }}>
          {/* Outer ring */}
          <div style={{
            width: '100%', height: '100%',
            border: `2.5px solid ${
              !faceDetected ? 'rgba(255,255,255,0.3)' :
              aligned ? '#64ffda' : '#ffab00'
            }`,
            borderRadius: 120,
            boxShadow: !faceDetected ? 'none' :
              aligned ? '0 0 30px rgba(100,255,218,0.3), inset 0 0 30px rgba(100,255,218,0.1)' :
              '0 0 20px rgba(255,171,0,0.2), inset 0 0 20px rgba(255,171,0,0.05)',
            transition: 'all 0.3s ease',
          }} />
        </div>

        {/* Position dots */}
        <PositionDots currentPos={currentPos} capturedSet={capturedSet} />

        {/* Progress ring */}
        <ProgressRing progress={progress} />

        {/* Status text */}
        <div style={{
          position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            padding: '8px 20px', borderRadius: 20,
          }}>
            <div style={{
              color: !faceDetected ? '#ff8a80' : aligned ? '#64ffda' : '#ffd740',
              fontSize: 15, fontWeight: 600, letterSpacing: 0.5,
            }}>
              {!faceDetected ? 'Face Not Found' :
               aligned ? 'Hold Still...' :
               phase === 'capturing' ? 'Capturing...' :
               getDirectionText(yaw, pitch, pos)}
            </div>
          </div>
        </div>

        {/* Cancel button */}
        <button onClick={onCancel} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none',
          borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}>✕</button>
      </div>

      {/* Bottom info */}
      <div style={{
        textAlign: 'center', padding: '12px 16px', color: '#78909c', fontSize: 13, lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 600, color: '#b0bec5', marginBottom: 4 }}>
          Position {currentPos + 1} of {CAPTURE_POSITIONS.length}
        </div>
        <div>
          {pos.label} — {pos.closeUp ? 'Move closer' : getDirectionDesc(yaw, pitch, pos)}
        </div>
      </div>

      {/* Captured thumbnails row */}
      {captured.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, padding: '0 16px 8px', overflowX: 'auto',
          justifyContent: 'center',
        }}>
          {captured.slice(-5).map((c) => (
            <img key={c.position} src={c.previewUrl} alt={c.label}
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helper functions ────────────────────────────────────────────────────

function getDirectionText(yaw: number, pitch: number, target: PositionTarget): string {
  const yawDiff = target.yawTarget - yaw;
  const pitchDiff = target.pitchTarget - pitch;
  const parts: string[] = [];
  if (Math.abs(yawDiff) > 5) parts.push(yawDiff > 0 ? 'Turn Right' : 'Turn Left');
  if (Math.abs(pitchDiff) > 4) parts.push(pitchDiff > 0 ? 'Tilt Down' : 'Tilt Up');
  if (parts.length === 0) return 'Hold Still...';
  return parts.join(' / ');
}

function getDirectionDesc(yaw: number, pitch: number, target: PositionTarget): string {
  const yawDiff = target.yawTarget - yaw;
  const pitchDiff = target.pitchTarget - pitch;
  if (Math.abs(yawDiff) < 8 && Math.abs(pitchDiff) < 6) return 'almost there, hold still...';
  return 'move your head to match the outline';
}

export { CAPTURE_POSITIONS };
export type { CapturedImage, PositionTarget };
