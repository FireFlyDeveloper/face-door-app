/// <reference types="vite/client" />

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BluetoothSerialPlugin {
  connect: (macAddress: string, success: () => void, failure: (err: string) => void) => void;
  disconnect: (success: () => void, failure: (err: string) => void) => void;
  write: (data: string, success: () => void, failure: (err: string) => void) => void;
  read: (success: (data: string) => void, failure: (err: string) => void) => void;
  readUntil: (delimiter: string, success: (data: string) => void, failure: (err: string) => void) => void;
  subscribe: (delimiter: string, success: (data: string) => void, failure: (err: string) => void) => void;
  unsubscribe: (success: () => void, failure: (err: string) => void) => void;
  clear: (success: () => void, failure: (err: string) => void) => void;
  list: (success: (devices: Array<{ id: string; name: string; address: string }>) => void, failure: (err: string) => void) => void;
  isEnabled: (success: (enabled: boolean) => void, failure: (err: string) => void) => void;
  isConnected: (success: (connected: boolean) => void, failure: (err: string) => void) => void;
  available: (success: (count: number) => void, failure: (err: string) => void) => void;
  showBluetoothSettings: () => void;
  enable: (success: () => void, failure: (err: string) => void) => void;
  discoverUnpaired: (success: (devices: Array<{ id: string; name: string; address: string }>) => void, failure: (err: string) => void) => void;
  setDeviceDiscoveredListener: (callback: (device: { id: string; name: string; address: string }) => void) => void;
  clearDeviceDiscoveredListener: () => void;
}

interface Window {
  bluetoothSerial?: BluetoothSerialPlugin;
}
