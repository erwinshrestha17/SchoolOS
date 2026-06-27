import { ForbiddenException } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

const parent: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'parent-user-1',
  email: 'parent@school.test',
  roles: ['parent'],
  permissions: [],
  authMethod: AuthMethod.PASSWORD,
};

describe('FinanceService receipt authorization', () => {
  it('denies a parent receipt outside linked-child scope before file lookup', async () => {
    const prisma = {
      guardian: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'guardian-1',
          studentLinks: [{ studentId: 'student-linked' }],
        }),
      },
      receipt: {
        findFirst: jest.fn(),
      },
    };
    const service = new FinanceService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getReceiptPdfForStudent('REC-001', 'student-not-linked', parent),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.receipt.findFirst).not.toHaveBeenCalled();
  });

  it('denies a finance receipt read without receipt permission', async () => {
    const service = new FinanceService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getReceiptPdf('REC-001', parent)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
