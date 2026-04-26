import {
  decryptSensitiveField,
  encryptSensitiveField,
  isEncryptedSensitiveField,
} from './field-encryption';

describe('field encryption', () => {
  it('encrypts and decrypts sensitive fields with AES-GCM', () => {
    const encrypted = encryptSensitiveField('peanut allergy', 'local-test-key');

    expect(encrypted).toContain('enc:v1:');
    expect(isEncryptedSensitiveField(encrypted)).toBe(true);
    expect(decryptSensitiveField(encrypted, 'local-test-key')).toBe(
      'peanut allergy',
    );
  });

  it('keeps legacy plaintext readable during migration', () => {
    expect(decryptSensitiveField('legacy note', 'local-test-key')).toBe(
      'legacy note',
    );
  });
});
