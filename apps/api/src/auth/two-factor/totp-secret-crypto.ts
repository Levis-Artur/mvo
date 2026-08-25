import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PAYLOAD_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export function encryptTotpSecret(
  secret: string,
  encodedKey = process.env.TOTP_ENCRYPTION_KEY,
): string {
  if (!secret) throw new Error('TOTP secret must not be empty');
  const key = encryptionKey(encodedKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptTotpSecret(
  payload: string,
  encodedKey = process.env.TOTP_ENCRYPTION_KEY,
): string {
  const key = encryptionKey(encodedKey);
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error('Malformed encrypted TOTP secret');
  }

  const iv = decodeBase64(parts[1], IV_BYTES);
  const authTag = decodeBase64(parts[2], AUTH_TAG_BYTES);
  const ciphertext = decodeBase64(parts[3]);
  if (!ciphertext.length) throw new Error('Malformed encrypted TOTP secret');

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Unable to decrypt TOTP secret');
  }
}

function encryptionKey(value: string | undefined): Buffer {
  if (!value) {
    throw new Error('Missing required environment variable: TOTP_ENCRYPTION_KEY');
  }
  const key = decodeBase64(value.trim(), KEY_BYTES);
  return key;
}

function decodeBase64(value: string, expectedBytes?: number): Buffer {
  if (
    !value ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error('Invalid base64 value');
  }
  const decoded = Buffer.from(value, 'base64');
  if (
    decoded.toString('base64') !== value ||
    (expectedBytes !== undefined && decoded.length !== expectedBytes)
  ) {
    throw new Error('Invalid base64 value');
  }
  return decoded;
}
