import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

export function encryptSensitiveField(
  value: string | null | undefined,
  rawKey: string,
) {
  if (!value) {
    return null;
  }

  if (isEncryptedSensitiveField(value)) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', normalizeAesKey(rawKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString(
    'base64',
  )}:${ciphertext.toString('base64')}`;
}

export function decryptSensitiveField(
  value: string | null | undefined,
  rawKey: string,
) {
  if (!value) {
    return null;
  }

  if (!isEncryptedSensitiveField(value)) {
    return value;
  }

  const [ivText, tagText, ciphertextText] = value
    .slice(ENCRYPTED_PREFIX.length)
    .split(':');

  if (!ivText || !tagText || !ciphertextText) {
    throw new Error('Encrypted field payload is malformed');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    normalizeAesKey(rawKey),
    Buffer.from(ivText, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncryptedSensitiveField(value: string | null | undefined) {
  return Boolean(value?.startsWith(ENCRYPTED_PREFIX));
}

function normalizeAesKey(rawKey: string) {
  const trimmed = rawKey.trim();

  if (!trimmed) {
    throw new Error('A medical encryption key is required');
  }

  const hex = Buffer.from(trimmed, 'hex');
  if (/^[\da-f]+$/i.test(trimmed) && hex.length === 32) {
    return hex;
  }

  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === 32) {
    return base64;
  }

  return createHash('sha256').update(trimmed).digest();
}
