import { createHash, randomBytes, randomInt } from 'crypto';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
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
