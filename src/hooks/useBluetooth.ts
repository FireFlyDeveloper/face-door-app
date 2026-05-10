import { useState, useCallback, useRef, useEffect } from 'react';
import { bluetooth, type BTDevice } from '../services/bluetooth';
import type { BTResponse } from '../services/protocol';

export const RSSI_THRESHOLD = -70;
const PI_MAC = '88:A2:9E:C4:5D:1F';
export const PI_NAME = 'Eyetracker';

const STORAGE_KEY = 'face_door_last_mac';

function loadLastMac(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function saveLastMac(mac: string) {
  try { localStorage.setItem(STORAGE_KEY, mac); } catch { /* ignore */ }
}

export interface UseBluetoothReturn {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  connectedDevice: BTDevice | null;
  error: string | null;
  pairedDevices: BTDevice[];
  rssi: number | null;
  isNearby: boolean | null;
  lastMac: string | null;
  isPi: boolean;
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
  listPaired: () => Promise<void>;
  ping: () => Promise<boolean>;
  pingWithRssi: () => Promise<number | null>;
  sendCommand: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export function useBluetooth(): UseBluetoothReturn {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [connectedDevice, setConnectedDevice] = useState<BTDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairedDevices, setPairedDevices] = useState<BTDevice[]>([]);
  const [rssi, setRssi] = useState<number | null>(null);
  const [lastMac, setLastMac] = useState<string | null>(loadLastMac);
  const deviceRef = useRef<BTDevice | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rssiTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConnectingRef = useRef(false);

  const isNearby = rssi !== null ? rssi >= RSSI_THRESHOLD : null;
  const isPi = connectedDevice?.address === PI_MAC;

  const connect = useCallback(async (address: string) => {
    if (!bluetooth.isAvailable()) {
      setStatus('error');
      setError('Bluetooth not available');
      return;
    }
    setStatus('connecting');
    setError(null);
    try {
      await bluetooth.connect(address);
      setStatus('connected');
      const dev = { id: address, name: address, address };
      deviceRef.current = dev;
      setConnectedDevice(dev);
      saveLastMac(address);
      setLastMac(address);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    setRssi(null);
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (rssiTimer.current) { clearInterval(rssiTimer.current); rssiTimer.current = null; }
    try { await bluetooth.disconnect(); } catch { /* ignore */ }
    setStatus('idle');
    setConnectedDevice(null);
    deviceRef.current = null;
  }, []);

  const listPaired = useCallback(async () => {
    if (!bluetooth.isAvailable()) return;
    try {
      const devices = await bluetooth.listPairedDevices();
      setPairedDevices(devices);
    } catch { /* ignore */ }
  }, []);

  const ping = useCallback(async (): Promise<boolean> => {
    if (status !== 'connected') return false;
    try {
      const resp = await bluetooth.sendCommand({ action: 'PING' });
      return resp?.response === 'pong';
    } catch { return false; }
  }, [status]);

  const pingWithRssi = useCallback(async (): Promise<number | null> => {
    if (status !== 'connected') return null;
    try {
      const resp = (await bluetooth.sendCommand({ action: 'PING' })) as unknown as BTResponse;
      if (resp?.response === 'pong') {
        const r = resp.rssi ?? null;
        setRssi(r);
        return r;
      }
      return null;
    } catch { return null; }
  }, [status]);

  const sendCommand = useCallback(async (cmd: Record<string, unknown>) => {
    return bluetooth.sendCommand(cmd);
  }, []);

  // ── Auto-connect on mount ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function autoConnect() {
      if (!bluetooth.isAvailable()) return;
      // Try to find the Pi in paired devices
      const devices = await bluetooth.listPairedDevices();
      if (!mounted) return;
      setPairedDevices(devices);

      const pi = devices.find((d) => d.address === PI_MAC);
      if (pi) {
        autoConnectingRef.current = true;
        await connect(pi.address);
        autoConnectingRef.current = false;
      }
    }
    autoConnect();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RSSI polling when connected ───────────────────────────────────────
  useEffect(() => {
    if (status === 'connected') {
      pingWithRssi();
      rssiTimer.current = setInterval(() => pingWithRssi(), 5000);
    }
    return () => {
      if (rssiTimer.current) { clearInterval(rssiTimer.current); rssiTimer.current = null; }
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-reconnect on error ──────────────────────────────────────────
  useEffect(() => {
    if (status === 'error' && !autoConnectingRef.current && lastMac) {
      reconnectTimer.current = setTimeout(() => {
        connect(lastMac);
      }, 3000);
    }
    return () => {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    };
  }, [status, lastMac]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status, connectedDevice, error, pairedDevices,
    rssi, isNearby, lastMac, isPi,
    connect, disconnect, listPaired,
    ping, pingWithRssi, sendCommand,
  };
}

export { PI_MAC };
