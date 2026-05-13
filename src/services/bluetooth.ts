/**
 * Bluetooth RFCOMM SPP client wrapper.
 * Uses cordova-plugin-bluetooth-serial via window.bluetoothSerial.
 *
 * Uses subscribe() for receiving — more reliable than readUntil() which can
 * miss data that arrived before the readUntil callback was registered.
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

// Listeners registered via subscribe()
const _responseListeners: Array<(line: string) => void> = [];
let _subscribed = false;

/** Subscribe once to incoming data and dispatch complete lines to listeners. */
function ensureSubscribed(): void {
  if (_subscribed) return;
  const bt = getBluetoothSerial();
  if (!bt || typeof bt.subscribe !== 'function') return;

  let buffer = '';
  bt.subscribe(
    NEWLINE,
    (data: string) => {
      // Each chunk ends with delimiter
      const line = (buffer + data).trim();
      buffer = '';
      if (!line) return;
      for (const listener of _responseListeners) {
        try { listener(line); } catch { /* ignore */ }
      }
    },
    () => {
      // subscribe failed or disconnected — reset for next connection
      _subscribed = false;
    },
  );
  _subscribed = true;
}

function clearSubscribe(): void {
  const bt = getBluetoothSerial();
  if (bt && typeof bt.unsubscribe === 'function') {
    try { bt.unsubscribe(() => {}, () => {}); } catch { /* ignore */ }
  }
  _subscribed = false;
  _responseListeners.length = 0;
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

const RESPONSE_TIMEOUT_MS = 8000;

/**
 * Send a JSON command and wait for the newline-terminated response.
 * Uses subscribe() under the hood for reliable delivery.
 */
async function sendCommand(command: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Ensure subscribe is running
  ensureSubscribed();

  // Clear stale data from the plugin buffer
  const bt = getBluetoothSerial();
  if (bt && typeof bt.clear === 'function') {
    await new Promise<void>((resolve) => bt.clear(resolve, () => resolve()));
  }

  // Create a promise that resolves on the next complete line
  const response = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = _responseListeners.indexOf(handler);
      if (idx !== -1) _responseListeners.splice(idx, 1);
      reject(new Error('Empty response from Pi'));
    }, RESPONSE_TIMEOUT_MS);

    const handler = (line: string) => {
      clearTimeout(timeout);
      const idx = _responseListeners.indexOf(handler);
      if (idx !== -1) _responseListeners.splice(idx, 1);
      resolve(line);
    };
    _responseListeners.push(handler);

    // Send command
    const json = JSON.stringify(command) + NEWLINE;
    write(json).catch((err) => {
      clearTimeout(timeout);
      const idx = _responseListeners.indexOf(handler);
      if (idx !== -1) _responseListeners.splice(idx, 1);
      reject(err);
    });
  });

  try {
    return JSON.parse(response);
  } catch {
    throw new Error(`Invalid JSON from Pi: ${response.slice(0, 80)}`);
  }
}

// ── Subscribe to incoming data stream (raw, for external use) ───────────

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
  readUntil: undefined as any, // removed — use sendCommand instead
  sendCommand,
  listPairedDevices,
  discoverUnpaired,
  subscribe,
  unsubscribe,
  clearSubscribe,
};
