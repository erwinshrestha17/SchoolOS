import { ConflictException } from '@nestjs/common';
import {
  AUTHORITY_FENCED_CODE,
  assertClientAuthorityFence,
  getOrCreateTenantAuthorityFence,
} from './authority-fence';

describe('authority fence', () => {
  it('creates a cloud fence on first discovery', async () => {
    const prisma = {
      tenantAuthorityFence: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          tenantId: 'tenant-1',
          authorityNodeId: 'cloud',
          authorityEpoch: 1,
        }),
      },
    };

    await expect(
      getOrCreateTenantAuthorityFence(prisma as never, 'tenant-1'),
    ).resolves.toEqual({
      authorityNodeId: 'cloud',
      authorityEpoch: 1,
    });
  });

  it('accepts omitted client fence fields during the compatibility window', async () => {
    const prisma = {
      tenantAuthorityFence: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId: 'tenant-1',
          authorityNodeId: 'cloud',
          authorityEpoch: 4,
        }),
      },
    };

    await expect(
      assertClientAuthorityFence(prisma as never, 'tenant-1', {}),
    ).resolves.toEqual({
      authorityNodeId: 'cloud',
      authorityEpoch: 4,
    });
  });

  it('rejects a stale authority epoch', async () => {
    const prisma = {
      tenantAuthorityFence: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId: 'tenant-1',
          authorityNodeId: 'cloud',
          authorityEpoch: 4,
        }),
      },
    };

    await expect(
      assertClientAuthorityFence(prisma as never, 'tenant-1', {
        authorityNodeId: 'cloud',
        authorityEpoch: 3,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: AUTHORITY_FENCED_CODE }),
    });
    await expect(
      assertClientAuthorityFence(prisma as never, 'tenant-1', {
        authorityEpoch: 3,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([[{ authorityNodeId: 'cloud' }], [{ authorityEpoch: 4 }]])(
    'rejects a partial client authority fence',
    async (client) => {
      const prisma = {
        tenantAuthorityFence: {
          findUnique: jest.fn().mockResolvedValue({
            tenantId: 'tenant-1',
            authorityNodeId: 'cloud',
            authorityEpoch: 4,
          }),
        },
      };

      await expect(
        assertClientAuthorityFence(prisma as never, 'tenant-1', client),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: AUTHORITY_FENCED_CODE }),
      });
    },
  );
});
