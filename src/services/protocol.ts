/**
 * Bluetooth JSON protocol helpers.
 * Matches the Pi's bluetooth_server.py command format.
 *
 * Registration uses a two-phase protocol:
 *   1. REGISTER_IMAGE — send one base64 image, Pi returns OK + index
 *   2. REGISTER_FINALIZE — after all 10 images, Pi averages & saves
 * This prevents long BT timeouts (ArcFace takes ~4s per image on Pi 4B).
 */

export interface RegisterImageCommand {
  action: 'REGISTER_IMAGE';
  face_id: string;
  image: string;  // single base64 JPEG string
}

export interface RegisterFinalizeCommand {
  action: 'REGISTER_FINALIZE';
  face_id: string;
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

export type BTCommand =
  | RegisterImageCommand
  | RegisterFinalizeCommand
  | DeleteCommand
  | ListCommand
  | PingCommand
  | GetLogCommand;

export interface BTResponse {
  status: 'OK' | 'ERROR';
  message?: string;
  response?: string;
  index?: number;          // current image index for REGISTER_IMAGE
  total?: number;          // total expected images
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

export function buildRegisterImage(faceId: string, base64: string): Record<string, unknown> {
  return { action: 'REGISTER_IMAGE', face_id: faceId, image: base64 };
}

export function buildRegisterFinalize(faceId: string): Record<string, unknown> {
  return { action: 'REGISTER_FINALIZE', face_id: faceId };
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
