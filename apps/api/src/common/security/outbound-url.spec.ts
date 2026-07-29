import {
  parseSafeExternalHttpsUrl,
  UnsafeOutboundUrlError,
} from './outbound-url';

describe('parseSafeExternalHttpsUrl', () => {
  it.each([
    'https://provider.example.com/api',
    'https://sandbox.gateway.example.com:8443/health',
  ])('accepts a public HTTPS provider URL: %s', (value) => {
    expect(parseSafeExternalHttpsUrl(value).toString()).toBe(value);
  });

  it.each([
    'http://provider.example/api',
    'https://user:secret@provider.example/api',
    'https://localhost/provider',
    'https://localhost./provider',
    'https://api.test/provider',
    'https://api.invalid/provider',
    'https://api.example/provider',
    'https://api.onion/provider',
    'https://api.alt/provider',
    'https://service.home.arpa/provider',
    'https://api.internal/provider',
    'https://10.0.0.1/provider',
    'https://127.0.0.1/provider',
    'https://169.254.169.254/latest/meta-data',
    'https://172.16.0.1/provider',
    'https://192.168.1.1/provider',
    'https://[::1]/provider',
    'https://[fd00::1]/provider',
    'https://[fec0::1]/provider',
    'https://[::ffff:127.0.0.1]/provider',
    'https://[2001:db8::1]/provider',
    'not-a-url',
  ])('rejects an unsafe provider destination: %s', (value) => {
    expect(() => parseSafeExternalHttpsUrl(value, 'Provider URL')).toThrow(
      UnsafeOutboundUrlError,
    );
  });
});
