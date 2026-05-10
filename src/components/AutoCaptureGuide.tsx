/**
 * AutoCaptureGuide — Real-time face tracking with auto-capture.
 *
 * Uses TensorFlow.js + face-landmarks-detection to read face orientation
 * from the live camera. Guides the user through 10 positions and captures
 * automatically when the face matches the target orientation.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// ── 10 capture positions with approximate yaw/pitch targets ──────────────
interface PositionTarget {
  id: number;
  label: string;
  desc: string;
  yawTarget: number;   // degrees, positive = right
  pitchTarget: number;  // degrees, positive = down
  closeUp: boolean;
}

const CAPTURE_POSITIONS: PositionTarget[] = [
  { id: 0,  label: 'Front',        desc: 'Look straight at camera',      yawTarget: 0,   pitchTarget: 0,   closeUp: false },
  { id: 1,  label: 'Front-Left',   desc: 'Turn head slightly left',      yawTarget: -15, pitchTarget: 0,   closeUp: false },
  { id: 2,  label: 'Front-Right',  desc: 'Turn head slightly right',     yawTarget: 15,  pitchTarget: 0,   closeUp: false },
  { id: 3,  label: 'Left-Profile', desc: 'Turn head ~45° left',          yawTarget: -35, pitchTarget: 0,   closeUp: false },
  { id: 4,  label: 'Right-Profile',desc: 'Turn head ~45° right',         yawTarget: 35,  pitchTarget: 0,   closeUp: false },
  { id: 5,  label: 'Up',           desc: 'Tilt head up',                 yawTarget: 0,   pitchTarget: -12, closeUp: false },
  { id: 6,  label: 'Down',         desc: 'Tilt head down',               yawTarget: 0,   pitchTarget: 12,  closeUp: false },
  { id: 7,  label: 'Top-Left',     desc: 'Look up-left',                 yawTarget: -15, pitchTarget: -10, closeUp: false },
  { id: 8,  label: 'Top-Right',    desc: 'Look up-right',                yawTarget: 15,  pitchTarget: -10, closeUp: false },
  { id: 9,  label: 'Close-Up',     desc: 'Move closer to camera',        yawTarget: 0,   pitchTarget: 0,   closeUp: true },
];

// Thresholds
const YAW_THRESHOLD = 12;   // degrees tolerance
const PITCH_THRESHOLD = 8;
const STABLE_FRAMES = 8;    // consecutive frames matching = capture
const CLOSEUP_FACE_RATIO = 0.35; // face width / video width

// Landmark indices (MediaPipe face mesh)
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

  // Yaw: nose horizontal offset from eye center, normalized by face width
  const yaw = faceW > 0 ? ((nose.x - faceCx) / faceW) * 90 : 0;

  // Pitch: nose vertical offset from face center, normalized by face height
  const pitch = faceH > 0 ? ((nose.y - faceCy) / faceH) * 60 : 0;

  // How much of the frame the face occupies (for close-up detection)
  const faceRatio = videoWidth > 0 ? faceW / videoWidth : 0;

  return { yaw, pitch, faceRatio };
}

function yawDir(yaw: number, target: number): string {
  const diff = target - yaw;
  if (Math.abs(diff) < 5) return 'Hold still...';
  return diff > 0 ? 'Turn RIGHT →' : '← Turn LEFT';
}

function pitchDir(pitch: number, target: number, yawOk: boolean): string {
  if (!yawOk) return '';
  const diff = target - pitch;
  if (Math.abs(diff) < 4) return 'Hold still...';
  return diff > 0 ? 'Tilt DOWN ↓' : '↑ Tilt UP';
}

// ── Component ───────────────────────────────────────────────────────────

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

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative', width: '100%', maxWidth: 480, margin: '0 auto',
    background: '#000', borderRadius: 12, overflow: 'hidden',
  },
  video: {
    width: '100%', display: 'block', transform: 'scaleX(-1)', // mirror
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  guide: {
    width: '65%', maxWidth: 240, aspectRatio: '3/4',
    border: '2px dashed rgba(100,255,218,0.6)', borderRadius: 16,
  },
  guideActive: {
    width: '65%', maxWidth: 240, aspectRatio: '3/4',
    border: '2px solid rgba(0,230,118,0.9)', borderRadius: 16,
    boxShadow: '0 0 20px rgba(0,230,118,0.3)',
  },
  posLabel: {
    position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center',
    color: '#fff', fontSize: 18, fontWeight: 700,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
  },
  direction: {
    position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center',
    fontSize: 22, fontWeight: 800, letterSpacing: 1,
    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
  },
  progress: {
    position: 'absolute', top: 12, left: 12,
    background: 'rgba(0,0,0,0.6)', color: '#64ffda',
    padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
  },
  stability: {
    position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center',
  },
  stableDots: {
    display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, background: '#333', transition: 'background 0.15s',
  },
  dotActive: {
    width: 8, height: 8, borderRadius: 4, background: '#64ffda',
    boxShadow: '0 0 6px #64ffda', transition: 'background 0.15s',
  },
  cancelBtn: {
    position: 'absolute', bottom: 12, right: 12,
    background: 'rgba(255,23,68,0.85)', color: '#fff',
    border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13,
    cursor: 'pointer', pointerEvents: 'auto', zIndex: 10,
  },
  thumbnails: {
    display: 'flex', gap: 4, padding: 8, overflowX: 'auto', background: '#0f0f1a',
  },
  thumb: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '2px solid transparent' },
  thumbDone: { width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '2px solid #64ffda' },
  thumbEmpty: {
    width: 48, height: 48, borderRadius: 6, background: '#222',
    border: '2px solid #333', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#555', fontSize: 10,
  },
  loading: {
    textAlign: 'center', padding: 40, color: '#64ffda', fontSize: 14,
  },
};

export default function AutoCaptureGuide({ onComplete, onCancel }: Props) {
  const [captured, setCaptured] = useState<CapturedImage[]>([]);
  const [currentPos, setCurrentPos] = useState(0);
  const [stableCount, setStableCount] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const frameRef = useRef<number>(0);
  const stableRef = useRef(0);
  const posRef = useRef(0);
  const capturedRef = useRef<CapturedImage[]>([]);
  const runningRef = useRef(true);

  const pos = CAPTURE_POSITIONS[currentPos];
  const isComplete = currentPos >= CAPTURE_POSITIONS.length;

  // ── Initialize model + camera ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Load TF.js backend
        await tf.setBackend('webgl');
        await tf.ready();

        // Load face landmarks detector
        const faceLandmarks = await import('@tensorflow-models/face-landmarks-detection');
        const model = faceLandmarks.SupportedModels.MediaPipeFaceMesh;
        const detector = await faceLandmarks.createDetector(model, {
          runtime: 'tfjs',
          refineLandmarks: true,
        });
        modelRef.current = detector;

        // Start camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setLoaded(true);
        processFrame(); // start detection loop
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize camera or model');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      runningRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Frame processing loop ────────────────────────────────────────────
  const processFrame = useCallback(async () => {
    if (!runningRef.current || !modelRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) {
      frameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const faces = await modelRef.current.estimateFaces(video);
      const hasFace = faces && faces.length > 0;
      setFaceDetected(hasFace);

      if (hasFace && faces[0].keypoints && faces[0].keypoints.length > 200) {
        const { yaw: y, pitch: p, faceRatio } = estimatePose(faces[0].keypoints, video.videoWidth);
        setYaw(y);
        setPitch(p);

        const target = CAPTURE_POSITIONS[posRef.current];
        if (!target) return;

        // Check if close-up condition is met
        const closeUpMet = !target.closeUp || faceRatio >= CLOSEUP_FACE_RATIO;

        // Check yaw match
        const yawMatch = Math.abs(y - target.yawTarget) <= YAW_THRESHOLD;
        const pitchMatch = Math.abs(p - target.pitchTarget) <= PITCH_THRESHOLD;

        if (yawMatch && pitchMatch && closeUpMet) {
          stableRef.current += 1;
          setStableCount(stableRef.current);

          // Auto-capture when stable enough
          if (stableRef.current >= STABLE_FRAMES) {
            stableRef.current = 0;
            setStableCount(0);

            // Capture frame from video
            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            const ctx = captureCanvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0);

            // Create File from canvas
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

            if (nextPos >= CAPTURE_POSITIONS.length) {
              runningRef.current = false;
              onComplete(updated);
              return;
            }
          }
        } else {
          stableRef.current = 0;
          setStableCount(0);
        }
      } else {
        stableRef.current = 0;
        setStableCount(0);
      }
    } catch {
      // Detection error, skip this frame
    }

    frameRef.current = requestAnimationFrame(processFrame);
  }, [onComplete]);

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#ff1744' }}>
        <div style={{ fontSize: 16, marginBottom: 12 }}>⚠️ {error}</div>
        <button onClick={onCancel}
          style={{ background: '#64ffda', color: '#0f0f1a', border: 'none',
            borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}>
          Try Manual Capture
        </button>
      </div>
    );
  }

  if (!loaded) {
    return <div style={styles.loading}>Loading face detection model...</div>;
  }

  if (isComplete) return null;

  const yawMatch = Math.abs(yaw - pos.yawTarget) <= YAW_THRESHOLD;
  const pitchMatch = Math.abs(pitch - pos.pitchTarget) <= PITCH_THRESHOLD;
  const dir = yawDir(yaw, pos.yawTarget);
  const pitchDirText = pitchDir(pitch, pos.pitchTarget, yawMatch);

  return (
    <div>
      <div style={styles.container}>
        <video ref={videoRef} autoPlay playsInline muted style={styles.video} />

        {/* Guide overlay */}
        <div style={styles.overlay}>
          <div style={yawMatch && pitchMatch ? styles.guideActive : styles.guide} />
        </div>

        {/* Position label */}
        <div style={styles.posLabel}>
          {captured.length + 1}. {pos.label}
        </div>

        {/* Direction guidance */}
        <div style={{
          ...styles.direction,
          color: faceDetected ? (yawMatch && pitchMatch ? '#64ffda' : '#ffab00') : '#ff1744',
        }}>
          {!faceDetected ? 'No face detected' :
           yawMatch && pitchMatch ? '✅ Hold still...' :
           pitchDirText || dir}
        </div>

        {/* Stability indicator */}
        <div style={styles.stability}>
          <div style={styles.stableDots}>
            {Array.from({ length: STABLE_FRAMES }).map((_, i) => (
              <div key={i} style={i < stableCount ? styles.dotActive : styles.dot} />
            ))}
          </div>
        </div>

        {/* Progress */}
        <div style={styles.progress}>{captured.length}/10</div>

        {/* Cancel */}
        <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>

      {/* Thumbnails */}
      <div style={styles.thumbnails}>
        {CAPTURE_POSITIONS.map((p) => {
          const cap = captured.find((c) => c.position === p.id);
          return cap ? (
            <img key={p.id} src={cap.previewUrl} alt={p.label} style={styles.thumbDone} />
          ) : (
            <div key={p.id} style={styles.thumbEmpty}>{p.label.slice(0, 2)}</div>
          );
        })}
      </div>
    </div>
  );
}

export { CAPTURE_POSITIONS };
export type { CapturedImage, PositionTarget };
