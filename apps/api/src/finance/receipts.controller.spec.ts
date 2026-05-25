import { StreamableFile } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { ReceiptsController } from './receipts.controller';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: ['receipts:read'],
};

describe('ReceiptsController PDF responses', () => {
  it('streams receipts as application/pdf', async () => {
    const service = {
      listReceipts: jest.fn(),
      getReceiptPdf: jest
        .fn()
        .mockResolvedValue(Buffer.from('%PDF-1.4\n%%EOF')),
    };
    const compatService = {
      getReceiptReprintHistory: jest.fn(),
    };
    const controller = new ReceiptsController(
      service as never,
      compatService as never,
    );

    const result = await controller.getReceiptPdf('REC-2026-00001', actor);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders()).toEqual(
      expect.objectContaining({
        type: 'application/pdf',
        disposition: 'inline; filename="REC-2026-00001.pdf"',
      }),
    );
  });
});
