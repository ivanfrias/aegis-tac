import { P2PMessage } from '../types/radar';

export interface EncryptedEnvelope {
  e2ee: true;
  iv: string;
  ct: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an un-guessable PeerJS signaling ID from (roomCode + squadPin)
 * using SHA-256 so outsiders cannot discover or dial the room without the PIN.
 */
export async function deriveStealthRoomPeerId(
  roomCode: string,
  squadPin: string
): Promise<string> {
  const normalized = `aegistac-stealth-v1:${roomCode.trim().toUpperCase()}:${squadPin.trim()}`;
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashHex = bytesToHex(new Uint8Array(hashBuffer));
  return `aegistac-sec-${hashHex.slice(0, 24)}`;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from the roomCode and squadPin using PBKDF2.
 */
export async function deriveSquadAesKey(
  roomCode: string,
  squadPin: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`${roomCode.trim().toUpperCase()}::${squadPin.trim()}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = enc.encode(
    `aegistac-salt-v1-${roomCode.trim().toUpperCase()}`
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a P2PMessage using AES-256-GCM with a random 96-bit IV.
 */
export async function encryptSquadMessage(
  msg: P2PMessage,
  key: CryptoKey
): Promise<EncryptedEnvelope> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(msg));
  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    e2ee: true,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertextBuf)),
  };
}

/**
 * Decrypts and authenticates an incoming AES-256-GCM envelope.
 * Returns null if tampered or encrypted with a different PIN.
 */
export async function decryptSquadMessage(
  data: unknown,
  key: CryptoKey
): Promise<P2PMessage | null> {
  if (!data || typeof data !== 'object') return null;
  const env = data as Partial<EncryptedEnvelope>;
  if (env.e2ee !== true || typeof env.iv !== 'string' || typeof env.ct !== 'string') {
    return null;
  }

  try {
    const iv = base64ToBytes(env.iv);
    const ct = base64ToBytes(env.ct);
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    const jsonStr = new TextDecoder().decode(decryptedBuf);
    return JSON.parse(jsonStr) as P2PMessage;
  } catch {
    // Authentication tag mismatch or wrong Squad PIN — drop silently
    return null;
  }
}
