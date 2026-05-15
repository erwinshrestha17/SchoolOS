import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('StudentQrCredential Prisma schema contract', () => {
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf8',
  );

  const model =
    /model StudentQrCredential \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? '';

  it('declares the QR credential model and status enum', () => {
    expect(schema).toContain('enum StudentQrStatus');
    expect(schema).toContain('ACTIVE');
    expect(schema).toContain('REVOKED');
    expect(model).toContain('model StudentQrCredential');
  });

  it('stores tokenHash only and never a raw token field', () => {
    expect(model).toContain('tokenHash');
    expect(model).not.toMatch(/\brawToken\b/);
    expect(model).not.toMatch(/\btoken\s+String\b/);
  });

  it('keeps the required uniqueness and tenant-scoped lookup indexes', () => {
    expect(model).toContain('@@unique([tenantId, studentId])');
    expect(model).toContain('@@unique([tokenHash])');
    expect(model).toContain('@@index([tenantId, studentId])');
    expect(model).toContain('@@index([tenantId, status])');
  });
});
