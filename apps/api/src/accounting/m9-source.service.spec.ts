import { JournalEntryStatus, JournalSourceType } from '@prisma/client';
import { M9SourceService } from './m9-source.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
} as any;

describe('M9SourceService', () => {
  it('summarizes tenant-scoped source mapping health across school modules', async () => {
    const prisma = {
      journalEntry: {
        findMany: jest.fn().mockResolvedValue([
          sourceEntry({
            id: 'fees-entry',
            sourceModule: 'FINANCE',
            sourceType: JournalSourceType.FEE_PAYMENT,
            sourceId: 'payment-1',
            accountCodes: ['1000', '4000'],
          }),
          sourceEntry({
            id: 'payroll-entry',
            sourceModule: 'PAYROLL',
            sourceType: JournalSourceType.PAYROLL_RUN,
            sourceId: 'payroll-run-1',
            accountCodes: ['5010', '2200'],
          }),
          sourceEntry({
            id: 'canteen-entry',
            sourceModule: 'CANTEEN',
            sourceType: JournalSourceType.FEE_PAYMENT,
            sourceId: 'canteen-sale-1',
            accountCodes: ['1000', '4050'],
          }),
          sourceEntry({
            id: 'library-entry',
            sourceModule: 'FINANCE',
            sourceType: JournalSourceType.INVOICE,
            sourceId: 'library-fine-1',
            accountCodes: ['1200', '4040'],
          }),
          sourceEntry({
            id: 'transport-entry',
            sourceModule: 'FINANCE',
            sourceType: JournalSourceType.INVOICE,
            sourceId: null,
            accountCodes: ['1200', '4030'],
          }),
        ]),
      },
    };
    const service = new M9SourceService(prisma as any);

    const result = await service.getSourceMappingHealth(actor);

    expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: JournalEntryStatus.POSTED,
        }),
        take: 1000,
      }),
    );
    expect(result.totalPostedSourceEntries).toBe(5);
    expect(result.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceModule: 'FEES',
          status: 'MAPPED',
          postedCount: 1,
        }),
        expect.objectContaining({
          sourceModule: 'PAYROLL',
          status: 'MAPPED',
          postedCount: 1,
        }),
        expect.objectContaining({
          sourceModule: 'CANTEEN',
          status: 'MAPPED',
          postedCount: 1,
        }),
        expect.objectContaining({
          sourceModule: 'LIBRARY',
          status: 'MAPPED',
          postedCount: 1,
        }),
        expect.objectContaining({
          sourceModule: 'TRANSPORT',
          status: 'MISSING_SOURCE_ID',
          missingSourceIdCount: 1,
        }),
      ]),
    );
    expect(result.missingSourceId).toEqual(
      expect.objectContaining({
        count: 1,
        samples: [
          expect.objectContaining({
            id: 'transport-entry',
            sourceModule: 'FINANCE',
            sourceType: JournalSourceType.INVOICE,
          }),
        ],
      }),
    );
    expect(result.isClean).toBe(false);
  });
});

function sourceEntry(input: {
  id: string;
  sourceModule: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  accountCodes: string[];
}) {
  return {
    id: input.id,
    entryNumber: `JE-${input.id}`,
    sourceModule: input.sourceModule,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    lines: input.accountCodes.map((code) => ({
      chartAccount: {
        code,
        type: code.startsWith('4') ? 'REVENUE' : 'ASSET',
      },
    })),
  };
}
