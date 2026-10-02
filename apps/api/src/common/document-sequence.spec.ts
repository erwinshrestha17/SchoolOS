import { ConflictException } from '@nestjs/common';
import {
  allocateDocumentNumber,
  DOCUMENT_SEQUENCE_KEYS,
} from './document-sequence';

describe('allocateDocumentNumber', () => {
  const client = (rows: unknown[]) => ({
    $queryRaw: jest.fn().mockResolvedValue(rows),
  });

  it('returns the value produced by the single upsert statement', async () => {
    const db = client([{ lastValue: 42 }]);
    await expect(
      allocateDocumentNumber(
        db as never,
        'tenant-1',
        DOCUMENT_SEQUENCE_KEYS.refund,
      ),
    ).resolves.toBe(42);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = db.$queryRaw.mock.calls[0]?.[0] as {
      strings: string[];
      values: unknown[];
    };
    expect(sql.strings.join('?')).toContain('ON CONFLICT');
    expect(sql.values).toEqual(['tenant-1', 'REFUND']);
  });

  it.each([[[]], [[{ lastValue: 0 }]], [[{ lastValue: 1.5 }]]])(
    'fails closed on an unusable allocation %j',
    async (rows) => {
      await expect(
        allocateDocumentNumber(client(rows) as never, 'tenant-1', 'EMPLOYEE'),
      ).rejects.toThrow(ConflictException);
    },
  );

  it('keys invoice numbering per fiscal-year prefix and the rest per tenant', () => {
    expect(DOCUMENT_SEQUENCE_KEYS.invoice('2082-83')).toBe('INVOICE:2082-83');
    expect(DOCUMENT_SEQUENCE_KEYS.cashierClose).toBe('CASHIER_CLOSE');
    expect(DOCUMENT_SEQUENCE_KEYS.employee).toBe('EMPLOYEE');
  });
});
