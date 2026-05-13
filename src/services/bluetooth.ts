/**
 * Bluetooth RFCOMM SPP client wrapper.
 * Uses cordova-plugin-bluetooth-serial via window.bluetoothSerial.
 *
 * Uses a polling read() approach for receiving — this is the most reliable
 * pattern across Cordova and Capacitor. subscribe() and readUntil() can
 * have timing/buffering issues.
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
  inProgress: string | null;
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

/**
 * Read all available data from the Bluetooth buffer.
 * Returns empty string if no data available.
 */
function readAll(): Promise<string> {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) return reject(new Error('BluetoothSerial not available'));
    bt.read(resolve, (err: string) => reject(new Error(err)));
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

// ── Internal buffer for partial reads ────────────────────────────────────

let _readBuffer = '';

// ── High-level: Send Command + Read Response ────────────────────────────

const POLL_INTERVAL_MS = 300;
const RESPONSE_TIMEOUT_MS = 60000;

/**
 * Send a JSON command and wait for the newline-terminated response.
 * Uses polling read() + internal buffer for maximum reliability.
 */
async function sendCommand(command: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Clear any stale data from the plugin buffer
  const bt = getBluetoothSerial();
  if (bt && typeof bt.clear === 'function') {
    await new Promise<void>((resolve) => bt.clear(resolve, () => resolve()));
  }

  // Send command with newline terminator
  const json = JSON.stringify(command) + NEWLINE;
  await write(json);

  // Poll for response
  const deadline = Date.now() + RESPONSE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    // Check if we already have a complete line in our internal buffer
    const nlIdx = _readBuffer.indexOf(NEWLINE);
    if (nlIdx !== -1) {
      const line = _readBuffer.slice(0, nlIdx).trim();
      _readBuffer = _readBuffer.slice(nlIdx + 1);
      if (line) {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`Invalid JSON from Pi: ${line.slice(0, 80)}`);
        }
      }
      // Empty line, skip and continue
      continue;
    }

    // Read more data from the plugin
    try {
      const chunk = await readAll();
      if (chunk) {
        _readBuffer += chunk;
        // Check again after adding new data
        const nlIdx2 = _readBuffer.indexOf(NEWLINE);
        if (nlIdx2 !== -1) {
          const line = _readBuffer.slice(0, nlIdx2).trim();
          _readBuffer = _readBuffer.slice(nlIdx2 + 1);
          if (line) {
            try {
              return JSON.parse(line);
            } catch {
              throw new Error(`Invalid JSON from Pi: ${line.slice(0, 80)}`);
            }
          }
        }
      }
    } catch {
      // read returned no data yet — keep polling
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Empty response from Pi');
}

// ── Subscribe to incoming data stream (kept for external use) ───────────

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
  sendCommand,
  listPairedDevices,
  discoverUnpaired,
  subscribe,
  unsubscribe,
};
