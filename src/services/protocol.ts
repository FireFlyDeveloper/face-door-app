/**
 * Bluetooth JSON protocol helpers.
 * Matches the Pi's main.py command format.
 */

export interface RegisterCommand {
  action: 'REGISTER';
  face_id: string;
  images: string[];  // base64 JPEG strings
}

export interface DeleteCommand {
  action: 'DELETE';
  face_id: string;
}

export interface ListCommand {
  action: 'LIST';
}

export interface PingCommand {
  action: 'PING';
}

export interface GetLogCommand {
  action: 'GET_LOG';
  limit: number;
}

export interface UnlockCommand {
  action: 'UNLOCK';
}

export interface LockCommand {
  action: 'LOCK';
}

export type BTCommand =
  | RegisterCommand
  | DeleteCommand
  | ListCommand
  | PingCommand
  | GetLogCommand
  | UnlockCommand
  | LockCommand;

export interface BTResponse {
  status: 'OK' | 'ERROR';
  message?: string;
  response?: string;
  rssi?: number;           // Bluetooth RSSI in dBm
  faces?: Array<{
    face_id: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
  count?: number;
  entries?: Array<{
    timestamp: string;
    face_id: string;
    result: string;
    details?: string;
  }>;
}

export function buildPing(): Record<string, unknown> {
  return { action: 'PING' };
}

export function buildRegister(faceId: string, images: string[]): Record<string, unknown> {
  return { action: 'REGISTER', face_id: faceId, images };
}

export function buildRegisterImage(faceId: string, image: string): Record<string, unknown> {
  return { action: 'REGISTER', face_id: faceId, image, partial: true };
}

export function buildRegisterFinalize(faceId: string): Record<string, unknown> {
  return { action: 'REGISTER', face_id: faceId, finalize: true };
}

export function buildDelete(faceId: string): Record<string, unknown> {
  return { action: 'DELETE', face_id: faceId };
}

export function buildList(): Record<string, unknown> {
  return { action: 'LIST' };
}

export function buildGetLog(limit = 50): Record<string, unknown> {
  return { action: 'GET_LOG', limit };
}

export function buildUnlock(): Record<string, unknown> {
  return { action: 'UNLOCK' };
}

export function buildLock(): Record<string, unknown> {
  return { action: 'LOCK' };
}
