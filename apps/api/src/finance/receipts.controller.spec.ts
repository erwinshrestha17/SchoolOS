import type { AuthContext } from '../auth/auth.types';
import { ReceiptsController } from './receipts.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'cashier@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const financeService = {
    listReceipts: jest.fn(),
    getReceiptPdf: jest.fn(),
    reprintReceipt: jest.fn(),
  };
  const financeCompatService = {
    getReceiptReprintHistory: jest.fn(),
    verifyReceipt: jest.fn(),
  };

  return {
    controller: new ReceiptsController(
      financeService as never,
      financeCompatService as never,
    ),
    financeService,
    financeCompatService,
  };
}

describe('ReceiptsController', () => {
  it('delegates receipt verification with current actor', () => {
    const { controller, financeCompatService } = createController();
    financeCompatService.verifyReceipt.mockReturnValue({
      verified: true,
      status: 'VALID',
      receipt: { receiptNumber: 'REC-2026-00001' },
    });

    const result = controller.verifyReceipt('REC-2026-00001', actor);

    expect(financeCompatService.verifyReceipt).toHaveBeenCalledWith(
      'REC-2026-00001',
      actor,
    );
    expect(result).toEqual({
      verified: true,
      status: 'VALID',
      receipt: { receiptNumber: 'REC-2026-00001' },
    });
  });
});
