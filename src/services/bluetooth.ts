/**
 * Bluetooth RFCOMM SPP client wrapper.
 * Uses cordova-plugin-bluetooth-serial via window.bluetoothSerial.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BTDevice {
  id: string;
  name: string;
  address: string;
}

export type BTStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface BTPageState {
  status: BTStatus;
  connectedDevice: BTDevice | null;
  error: string | null;
  inProgress: string | null; // e.g. "Registering..." or "Fetching..."
}

export type BTListener = (data: string) => void;

const NEWLINE = '\n';

function getBluetoothSerial(): any {
  return (window as any).bluetoothSerial;
}

function isAvailable(): boolean {
  return typeof getBluetoothSerial() !== 'undefined';
}

// ── Connection ──────────────────────────────────────────────────────────

function connect(address: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.connect(address, resolve, (err: string) => reject(new Error(err)));
  });
}

function disconnect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return resolve();
    bt.disconnect(resolve, (err: string) => reject(new Error(err)));
  });
}

// ── Data Transfer ───────────────────────────────────────────────────────

function write(data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.write(data, resolve, (err: string) => reject(new Error(err)));
  });
}

function readUntil(delimiter: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.readUntil(delimiter, resolve, (err: string) => reject(new Error(err)));
  });
}

// ── Device Discovery ────────────────────────────────────────────────────

function listPairedDevices(): Promise<BTDevice[]> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.list(resolve, (err: string) => reject(new Error(err)));
  });
}

function discoverUnpaired(): Promise<BTDevice[]> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.discoverUnpaired(resolve, (err: string) => reject(new Error(err)));
  });
}

// ── High-level: Send Command + Read Response ────────────────────────────

/**
 * Send a JSON command and read the newline-terminated response.
 */
async function sendCommand(command: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Clear buffer FIRST to discard stale data (stray newlines on connect)
  // IMPORTANT: Do this BEFORE write — clearing after write races with the Pi's response
  const bt = getBluetoothSerial();
  if (bt && typeof bt.clear === 'function') {
    await new Promise<void>((resolve) => bt.clear(resolve, () => resolve()));
  }
  const json = JSON.stringify(command) + NEWLINE;
  await write(json);
  const raw = await readUntil(NEWLINE);
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty response from Pi');
  return JSON.parse(trimmed);
}

// ── Subscribe to incoming data stream ─────────────────────────────────────

function subscribe(listener: BTListener): Promise<void> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.subscribe(
      NEWLINE,
      (data: string) => { resolve(); listener(data); },
      (err: string) => reject(new Error(err)),
    );
  });
}

function unsubscribe(): Promise<void> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return resolve();
    bt.unsubscribe(resolve, (err: string) => reject(new Error(err)));
  });
}

// ── Platform check ──────────────────────────────────────────────────────

export const bluetooth = {
  isAvailable,
  connect,
  disconnect,
  write,
  readUntil,
  sendCommand,
  listPairedDevices,
  discoverUnpaired,
  subscribe,
  unsubscribe,
};
