import { PaymentMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceCompatController } from './finance-compat.controller';

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
    getDuesTableReport: jest.fn(),
    listDefaulters: jest.fn(),
    sendDefaulterReminders: jest.fn(),
    getCollectionReport: jest.fn(),
    previewCashierClose: jest.fn(),
    listCashierCloses: jest.fn(),
    finalizeCashierClose: jest.fn(),
    collectPayment: jest.fn(),
    refundPayment: jest.fn(),
    reversePayment: jest.fn(),
    reprintReceipt: jest.fn(),
  };
  const financeCompatService = {
    getReceiptReprintHistory: jest.fn(),
    exportStudentFeeLedgerCsv: jest.fn(),
  };

  return {
    controller: new FinanceCompatController(
      financeService as never,
      financeCompatService as never,
    ),
    financeService,
    financeCompatService,
  };
}

describe('FinanceCompatController', () => {
  it('delegates finance dues query with current actor', () => {
    const { controller, financeService } = createController();
    const query = {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      feeHeadId: 'fee-head-1',
      status: 'PARTIAL',
      page: 1,
      limit: 50,
    };
    financeService.getDuesTableReport.mockReturnValue({ rows: [] });

    const result = controller.listDues(query as never, actor);

    expect(financeService.getDuesTableReport).toHaveBeenCalledWith(
      query,
      actor,
    );
    expect(result).toEqual({ rows: [] });
  });

  it('delegates idempotent payment collection payload', () => {
    const { controller, financeService } = createController();
    const dto = {
      invoiceId: 'invoice-1',
      amount: 1000,
      method: PaymentMethod.CASH,
      referenceNumber: 'CASH-001',
      idempotencyKey: 'payment-key-1',
    };
    financeService.collectPayment.mockReturnValue({ id: 'payment-1' });

    const result = controller.collectPayment(dto, actor);

    expect(financeService.collectPayment).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ id: 'payment-1' });
  });

  it('maps payment reverse endpoint to reversal workflow', () => {
    const { controller, financeService } = createController();
    const dto = {
      reason: 'Duplicate payment',
      idempotencyKey: 'reverse-payment-1',
    };
    financeService.reversePayment.mockReturnValue({ id: 'reversal-1' });

    const result = controller.reversePayment('payment-1', dto as never, actor);

    expect(financeService.reversePayment).toHaveBeenCalledWith(
      'payment-1',
      dto,
      actor,
    );
    expect(financeService.refundPayment).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'reversal-1' });
  });

  it('maps payment correct endpoint to controlled correction workflow', () => {
    const { controller, financeService } = createController();
    const dto = {
      amount: 500,
      reason: 'Cashier correction',
      idempotencyKey: 'correct-payment-1',
    };
    financeService.refundPayment.mockReturnValue({ id: 'refund-2' });

    const result = controller.correctPayment('payment-1', dto as never, actor);

    expect(financeService.refundPayment).toHaveBeenCalledWith(
      'payment-1',
      dto,
      actor,
    );
    expect(result).toEqual({ id: 'refund-2' });
  });

  it('returns receipt reprint history from compatibility service', () => {
    const { controller, financeCompatService } = createController();
    financeCompatService.getReceiptReprintHistory.mockReturnValue({
      receiptId: 'receipt-1',
      items: [],
    });

    const result = controller.getReceiptReprintHistory('receipt-1', actor);

    expect(financeCompatService.getReceiptReprintHistory).toHaveBeenCalledWith(
      'receipt-1',
      actor,
    );
    expect(result).toEqual({ receiptId: 'receipt-1', items: [] });
  });

  it('returns protected receipt reprint metadata', async () => {
    const { controller, financeService } = createController();
    financeService.reprintReceipt.mockResolvedValue({
      receiptId: 'receipt-1',
      reprintHistoryId: 'history-1',
      fileAssetId: 'file-1',
      fileName: 'Receipt_R-001_Reprint.pdf',
      disposition: 'SUCCEEDED',
    });
    const dto = {
      reason: 'Parent requested copy',
      idempotencyKey: 'reprint-receipt-1',
    };

    const result = await controller.reprintReceipt('receipt-1', dto, actor);

    expect(financeService.reprintReceipt).toHaveBeenCalledWith(
      'receipt-1',
      dto,
      actor,
    );
    expect(result).toEqual(
      expect.objectContaining({
        fileAssetId: 'file-1',
        disposition: 'SUCCEEDED',
      }),
    );
  });

  it('exports student fee ledger CSV from compatibility service', () => {
    const { controller, financeCompatService } = createController();
    financeCompatService.exportStudentFeeLedgerCsv.mockReturnValue(
      'Student ID,Invoice Number\nS-001,INV-001',
    );

    const result = controller.exportStudentFeeLedger('student-1', actor);

    expect(financeCompatService.exportStudentFeeLedgerCsv).toHaveBeenCalledWith(
      'student-1',
      actor,
    );
    expect(result).toBe('Student ID,Invoice Number\nS-001,INV-001');
  });
});
