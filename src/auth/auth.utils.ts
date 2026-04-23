import { createHash, randomBytes } from 'crypto';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken() {
  return randomBytes(48).toString('hex');
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
