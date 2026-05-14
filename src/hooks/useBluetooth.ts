import { useState, useCallback, useRef } from 'react';
import { bluetooth, type BTDevice } from '../services/bluetooth';
import type { BTResponse } from '../services/protocol';

/** RSSI threshold in dBm — values must be >= this to allow operations */
export const RSSI_THRESHOLD = -70;

export interface UseBluetoothReturn {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  connectedDevice: BTDevice | null;
  error: string | null;
  pairedDevices: BTDevice[];
  rssi: number | null;                // last measured RSSI
  isNearby: boolean | null;           // true if rssi >= threshold
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
  listPaired: () => Promise<void>;
  ping: () => Promise<boolean>;
  pingWithRssi: () => Promise<number | null>;  // returns RSSI
  sendCommand: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
  unlockDoor: () => Promise<{ ok: boolean; error?: string }>;
  lockDoor: () => Promise<{ ok: boolean; error?: string }>;
}

export function useBluetooth(): UseBluetoothReturn {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [connectedDevice, setConnectedDevice] = useState<BTDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairedDevices, setPairedDevices] = useState<BTDevice[]>([]);
  const [rssi, setRssi] = useState<number | null>(null);
  const deviceRef = useRef<BTDevice | null>(null);

  const isNearby = rssi !== null ? rssi >= RSSI_THRESHOLD : null;

  const connect = useCallback(async (address: string) => {
    if (!bluetooth.isAvailable()) {
      setStatus('error');
      setError('Bluetooth not available on this device');
      return;
    }
    setStatus('connecting');
    setError(null);
    try {
      await bluetooth.connect(address);
      setStatus('connected');
      const dev = {
        id: address,
        name: address,
        address,
      };
      deviceRef.current = dev;
      setConnectedDevice(dev);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    setRssi(null);
    try {
      await bluetooth.disconnect();
    } catch {
      // ignore
    }
    setStatus('idle');
    setConnectedDevice(null);
    deviceRef.current = null;
  }, []);

  const listPaired = useCallback(async () => {
    if (!bluetooth.isAvailable()) return;
    try {
      const devices = await bluetooth.listPairedDevices();
      setPairedDevices(devices);
    } catch {
      // ignore
    }
  }, []);

  const ping = useCallback(async (): Promise<boolean> => {
    if (status !== 'connected') return false;
    try {
      const resp = await bluetooth.sendCommand({ action: 'PING' });
      return resp?.response === 'pong';
    } catch {
      return false;
    }
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
    } catch {
      return null;
    }
  }, [status]);

  const sendCommand = useCallback(async (cmd: Record<string, unknown>) => {
    return bluetooth.sendCommand(cmd);
  }, []);

  const unlockDoor = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (status !== 'connected') {
      return { ok: false, error: 'Not connected' };
    }
    try {
      const resp = await bluetooth.sendCommand({ action: 'UNLOCK' }) as unknown as BTResponse;
      if (resp?.status === 'OK') {
        return { ok: true };
      }
      return { ok: false, error: resp?.message || 'UNLOCK failed' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNLOCK command failed';
      return { ok: false, error: msg };
    }
  }, [status]);

  const lockDoor = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (status !== 'connected') {
      return { ok: false, error: 'Not connected' };
    }
    try {
      const resp = await bluetooth.sendCommand({ action: 'LOCK' }) as unknown as BTResponse;
      if (resp?.status === 'OK') {
        return { ok: true };
      }
      return { ok: false, error: resp?.message || 'LOCK failed' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LOCK command failed';
      return { ok: false, error: msg };
    }
  }, [status]);

  return {
    status,
    connectedDevice,
    error,
    pairedDevices,
    rssi,
    isNearby,
    connect,
    disconnect,
    listPaired,
    ping,
    pingWithRssi,
    sendCommand,
    unlockDoor,
    lockDoor,
  };
}
