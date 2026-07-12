import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { findDuplicateActiveCredentials } from './duplicate-active-preflight';

describe('QR credential duplicate-active preflight', () => {
  const source = readFileSync(
    join(__dirname, 'duplicate-active-preflight.ts'),
    'utf8',
  );

  function prismaWithRows(
    rows: Array<{
      tenantId: string;
      studentId: string;
      activeCredentialCount: bigint;
    }>,
  ) {
    return {
      $queryRaw: jest.fn().mockResolvedValue(rows),
    } as unknown as PrismaClient;
  }

  it('returns no rows when there are no duplicate ACTIVE credentials', async () => {
    const prisma = prismaWithRows([]);
    const result = await findDuplicateActiveCredentials(prisma);
    expect(result).toEqual([]);
  });

  it('surfaces duplicate ACTIVE tenant/student pairs with only safe fields', async () => {
    const prisma = prismaWithRows([
      { tenantId: 'ten-1', studentId: 'stu-1', activeCredentialCount: 2n },
    ]);
    const result = await findDuplicateActiveCredentials(prisma);
    expect(result).toEqual([
      { tenantId: 'ten-1', studentId: 'stu-1', activeCredentialCount: 2n },
    ]);
    expect(Object.keys(result[0]).sort()).toEqual(
      ['activeCredentialCount', 'studentId', 'tenantId'].sort(),
    );
  });

  it('groups strictly by tenantId and studentId, scoped to ACTIVE status', () => {
    expect(source).toContain('"status" = \'ACTIVE\'');
    expect(source).toContain('GROUP BY "tenantId", "studentId"');
    expect(source).toContain('HAVING COUNT(*) > 1');
  });

  it('never selects or logs sensitive credential fields', () => {
    expect(source).not.toMatch(/tokenHash/i);
    expect(source).not.toMatch(/fileAssetId/i);
    expect(source).not.toMatch(/objectKey/i);
  });

  it('documents the required manual, domain-approved remediation steps', () => {
    expect(source).toContain('Required remediation (manual, domain-approved');
    expect(source).toContain('do not automate');
    expect(source).toContain('Preserve audit/history');
  });

  it('exits non-zero when duplicates are found and zero otherwise', () => {
    expect(source).toContain('process.exit(1)');
    expect(source).toContain('process.exit(0)');
  });

  it('treats a not-yet-created StudentQrCredential table as "no duplicates", not a crash', async () => {
    const undefinedTableError = {
      code: 'P2010',
      meta: {
        driverAdapterError: {
          cause: { originalCode: '42P01' },
        },
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(undefinedTableError),
    } as unknown as PrismaClient;

    await expect(findDuplicateActiveCredentials(prisma)).resolves.toEqual([]);
  });

  it('still fails loudly on unrelated database errors', async () => {
    const connectionError = { code: 'P1001', message: 'Cannot reach database' };
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(connectionError),
    } as unknown as PrismaClient;

    await expect(findDuplicateActiveCredentials(prisma)).rejects.toBe(
      connectionError,
    );
  });
});
