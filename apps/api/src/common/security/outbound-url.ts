import { isIP } from 'node:net';

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
  '.test',
  '.invalid',
  '.example',
  '.onion',
  '.alt',
  '.arpa',
];

export class UnsafeOutboundUrlError extends Error {
  constructor(label: string) {
    super(`${label} must be a public HTTPS URL`);
    this.name = 'UnsafeOutboundUrlError';
  }
}

export function parseSafeExternalHttpsUrl(
  value: string,
  label = 'Outbound URL',
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UnsafeOutboundUrlError(label);
  }

  const hostname = parsed.hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    hostname.length === 0 ||
    hostname === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    isBlockedIpLiteral(hostname)
  ) {
    throw new UnsafeOutboundUrlError(label);
  }

  return parsed;
}

function isBlockedIpLiteral(hostname: string) {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    return isBlockedIpv4(hostname);
  }
  if (ipVersion === 6) {
    return isBlockedIpv6(hostname);
  }
  return false;
}

function isBlockedIpv4(value: string) {
  const octets = value.split('.').map(Number);
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && octets[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe') ||
    normalized.startsWith('ff')
  ) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return isBlockedIpv4(mapped);
    }
    const [high, low] = mapped.split(':');
    if (high && low) {
      const highValue = Number.parseInt(high, 16);
      const lowValue = Number.parseInt(low, 16);
      if (
        Number.isInteger(highValue) &&
        Number.isInteger(lowValue) &&
        highValue >= 0 &&
        highValue <= 0xffff &&
        lowValue >= 0 &&
        lowValue <= 0xffff
      ) {
        return isBlockedIpv4(
          [
            highValue >> 8,
            highValue & 0xff,
            lowValue >> 8,
            lowValue & 0xff,
          ].join('.'),
        );
      }
    }
    return true;
  }

  return normalized.startsWith('2001:db8:');
}
