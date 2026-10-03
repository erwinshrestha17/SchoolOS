import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  BANK_ADVICE_CSV_HEADER,
  PayrollBankAdviceService,
  textCell,
} from './payroll-bank-advice.service';

jest.mock('../auth/school-authorization-transaction', () => ({
  withSchoolAuthorizationTransaction: jest.fn(
    async (
      prisma: { __tx: unknown },
      _actor: unknown,
      _permission: unknown,
      _scopes: unknown,
      work: (tx: unknown) => Promise<unknown>,
    ) => work(prisma.__tx),
  ),
}));

const actor = (permissions: string[]): AuthContext => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'a@school.test',
  roles: ['payroll_approver'],
  permissions,
  authMethod: 'PASSWORD',
});
const exporter = actor(['payroll:bank-advice:export']);

const line = (overrides: Record<string, unknown> = {}) => ({
  id: 'line-1',
  staffId: 'staff-1',
  netSalary: new Prisma.Decimal('31500.5'),
  staff: {
    employeeId: 'EMP-1',
    firstName: 'Sita',
    lastName: 'Sharma',
    bankName: 'Fixture Bank',
    bankAccount: '0123456789',
  },
  salaryStructure: { paymentMethod: 'BANK' },
  ...overrides,
});

function build(
  options: {
    status?: string;
    fingerprint?: string;
    approved?: string | null;
    lines?: Record<string, unknown>[];
    holds?: Record<string, unknown>[];
    lastSequence?: number | null;
  } = {},
) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    payrollRun: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'run-1',
        status: options.status ?? 'FINALIZED',
        periodYear: 2083,
        periodMonth: 7,
        approvedSourceFingerprint:
          options.approved === undefined ? 'fp-1' : options.approved,
      }),
    },
    payrollLine: {
      findMany: jest.fn().mockResolvedValue(options.lines ?? [line()]),
    },
    payrollHold: { findMany: jest.fn().mockResolvedValue(options.holds ?? []) },
    payrollBankAdviceExport: {
      aggregate: jest.fn().mockResolvedValue({
        _max: { sequence: options.lastSequence ?? null },
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'export-1',
        ...data,
      })),
    },
  };
  const prisma = {
    __tx: tx,
    payrollRun: { findFirst: jest.fn().mockResolvedValue({ id: 'run-1' }) },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const payroll = {
    currentSourceFingerprint: jest
      .fn()
      .mockResolvedValue(options.fingerprint ?? 'fp-1'),
  };
  return {
    service: new PayrollBankAdviceService(
      prisma as never,
      audit as never,
      payroll as never,
    ),
    prisma,
    tx,
    audit,
    payroll,
  };
}

describe('textCell', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(textCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(textCell('+1')).toBe("'+1");
    expect(textCell('-1')).toBe("'-1");
    expect(textCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(textCell('\tX')).toBe("'\tX");
    expect(textCell('Sharma, Sita')).toBe('"Sharma, Sita"');
    expect(textCell('a\r\nb')).toBe('a b');
    expect(textCell('Plain Name')).toBe('Plain Name');
  });
});

describe('PayrollBankAdviceService.export', () => {
  it('requires the export permission', async () => {
    const { service } = build();
    await expect(
      service.export('run-1', {}, actor(['payroll:run:read'])),
    ).rejects.toMatchObject({
      response: { code: 'DOMAIN_AUTHORIZATION_DENIED' },
    });
  });

  it('exports the generic CSV, records sequence 1 with hash and fingerprint, and audits without bank details', async () => {
    const { service, tx, audit } = build();
    const result = await service.export('run-1', {}, exporter);
    expect(result.csv).toBe(
      `${BANK_ADVICE_CSV_HEADER}\r\n1,EMP-1,Sita Sharma,Fixture Bank,0123456789,31500.50,NPR,PAYROLL-2083-07-EMP-1\r\n`,
    );
    expect(result.sequence).toBe(1);
    expect(result.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(tx.payrollBankAdviceExport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        payrollRunId: 'run-1',
        sequence: 1,
        exportedById: 'user-1',
        lineCount: 1,
        heldLineCount: 0,
        totalAmount: '31500.50',
        sourceFingerprint: 'fp-1',
        contentSha256: result.contentSha256,
        reExportReason: null,
      }),
    });
    const audited = JSON.stringify(audit.record.mock.calls);
    expect(audited).not.toContain('0123456789');
    expect(audited).not.toContain('Sita');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export',
        resource: 'payroll_bank_advice',
      }),
      tx,
    );
  });

  it('only exports finalized or posted runs', async () => {
    for (const status of ['DRAFT', 'GENERATED', 'APPROVED', 'PAID', 'VOID']) {
      const { service, tx } = build({ status });
      await expect(service.export('run-1', {}, exporter)).rejects.toMatchObject(
        {
          response: { code: 'PAYROLL_BANK_ADVICE_RUN_STATE' },
        },
      );
      expect(tx.payrollBankAdviceExport.create).not.toHaveBeenCalled();
    }
    const posted = build({ status: 'POSTED' });
    await expect(
      posted.service.export('run-1', {}, exporter),
    ).resolves.toBeTruthy();
  });

  it('refuses when the source data no longer matches the approved fingerprint', async () => {
    for (const options of [{ fingerprint: 'fp-changed' }, { approved: null }]) {
      const { service, tx } = build(options);
      await expect(service.export('run-1', {}, exporter)).rejects.toMatchObject(
        {
          response: { code: 'PAYROLL_BANK_ADVICE_SOURCE_CHANGED' },
        },
      );
      expect(tx.payrollBankAdviceExport.create).not.toHaveBeenCalled();
    }
  });

  it('exports bank-paid lines only: other methods, zero net and held lines are left out', async () => {
    const { service, tx } = build({
      lines: [
        line(),
        line({
          id: 'line-2',
          staffId: 'staff-2',
          staff: { ...line().staff, employeeId: 'EMP-2' },
          salaryStructure: { paymentMethod: 'CASH' },
        }),
        line({
          id: 'line-3',
          staffId: 'staff-3',
          staff: { ...line().staff, employeeId: 'EMP-3' },
          netSalary: new Prisma.Decimal(0),
        }),
        line({
          id: 'line-4',
          staffId: 'staff-4',
          staff: { ...line().staff, employeeId: 'EMP-4' },
        }),
        line({
          id: 'line-5',
          staffId: 'staff-5',
          staff: { ...line().staff, employeeId: 'EMP-5' },
          salaryStructure: null,
        }),
      ],
      holds: [{ staffId: 'staff-4' }],
    });
    const result = await service.export('run-1', {}, exporter);
    expect(result.lineCount).toBe(1);
    expect(result.csv).toContain('EMP-1');
    for (const id of ['EMP-2', 'EMP-3', 'EMP-4', 'EMP-5'])
      expect(result.csv).not.toContain(id);
    expect(tx.payrollBankAdviceExport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lineCount: 1, heldLineCount: 1 }),
    });
  });

  it('refuses invalid bank details with masked machine-readable issues and records nothing', async () => {
    const { service, tx } = build({
      lines: [
        line({
          staff: { ...line().staff, bankAccount: '=cmd|x', bankName: null },
        }),
      ],
    });
    let error: { response?: { code: string; issues: unknown[] } } = {};
    try {
      await service.export('run-1', {}, exporter);
    } catch (caught) {
      error = caught as typeof error;
    }
    expect(error.response?.code).toBe(
      'PAYROLL_BANK_ADVICE_INVALID_BANK_DETAILS',
    );
    expect(error.response?.issues).toEqual([
      {
        staffId: 'staff-1',
        employeeId: 'EMP-1',
        problem: 'BANK_ACCOUNT_INVALID',
        maskedAccount: '••••md|x',
      },
      {
        staffId: 'staff-1',
        employeeId: 'EMP-1',
        problem: 'BANK_NAME_MISSING',
        maskedAccount: '••••md|x',
      },
    ]);
    expect(JSON.stringify(error.response)).not.toContain('=cmd');
    expect(tx.payrollBankAdviceExport.create).not.toHaveBeenCalled();
  });

  it('refuses a run with nothing payable', async () => {
    const { service } = build({
      lines: [line({ salaryStructure: { paymentMethod: 'CASH' } })],
    });
    await expect(service.export('run-1', {}, exporter)).rejects.toMatchObject({
      response: { code: 'PAYROLL_BANK_ADVICE_NOTHING_PAYABLE' },
    });
  });

  it('requires a reason to export again and records the next sequence', async () => {
    const first = build({ lastSequence: 1 });
    await expect(
      first.service.export('run-1', {}, exporter),
    ).rejects.toMatchObject({
      response: { code: 'PAYROLL_BANK_ADVICE_REEXPORT_REASON_REQUIRED' },
    });
    const again = build({ lastSequence: 1 });
    const result = await again.service.export(
      'run-1',
      { reExportReason: 'Bank rejected the file' },
      exporter,
    );
    expect(result.sequence).toBe(2);
    expect(again.tx.payrollBankAdviceExport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sequence: 2,
        reExportReason: 'Bank rejected the file',
      }),
    });
  });

  it('locks the run row so concurrent exports serialise', async () => {
    const { service, tx } = build();
    await service.export('run-1', {}, exporter);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('does not reveal another tenant run', async () => {
    const { service, prisma } = build();
    prisma.payrollRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.export('run-9', {}, exporter)).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.payrollRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'run-9', tenantId: 'tenant-1' } }),
    );
  });
});
