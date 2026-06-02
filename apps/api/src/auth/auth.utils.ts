import { createHash, createHmac, randomBytes, randomInt } from 'crypto';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hmacToken(token: string, pepper: string) {
  return createHmac('sha256', pepper).update(token).digest('hex');
}

export function hashOtpCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export function generateRefreshToken() {
  return randomBytes(48).toString('hex');
}

export function generateOtpCode(length: number) {
  const upperBound = 10 ** length;
  return String(randomInt(0, upperBound)).padStart(length, '0');
}

export function parseCookie(header: string | undefined, name: string) {
  if (!header) {
    return undefined;
  }

  return header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function generateCsrfToken(secret: string) {
  const value = randomBytes(24).toString('hex');
  const signature = createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${signature}`;
}

export function verifyCsrfToken(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [value, signature] = parts;
  const expectedSignature = createHmac('sha256', secret)
    .update(value)
    .digest('hex');
  return signature === expectedSignature;
}
