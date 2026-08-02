import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { AccountingReportsService } from '../accounting/accounting-reports.service';
import { PayrollService } from '../payroll/payroll.service';
import { AuthMethod, FileStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PlansService } from '../plans/plans.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  createTeacherScopeDeniedException,
  TEACHER_SCOPE_DENIED_CODE,
  TeacherScopeService,
} from '../teacher-scope/teacher-scope.service';
import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import { FINANCIAL_REPORT_DEFINITION_VERSION } from '@schoolos/core';
import { findFinancialReportDefinition } from '@schoolos/core';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let audit: AuditService;
  let fileRegistry: FileRegistryService;
  let plansService: jest.Mocked<PlansService>;
  let reportsQueue: { add: jest.Mock };
  let teacherScopeService: {
    requireActorAccess: jest.Mock;
    denyActorAccess: jest.Mock;
  };

  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'admin@schoolos.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: [
      'reports:read',
      'reports:export',
      'students:read',
      'classes:read',
      'attendance:read',
      'ledger:read',
      'receipts:read',
      'accounting:reports:read',
      'payroll:reports:read',
      'academics:read',
    ],
    tenantSlug: 'everest',
  };

  it('registers exactly the 75 applicable P0 finance reports and excludes FA-01', () => {
    const catalog = service.listFinancialReportCatalog(actor);

    expect(catalog).toHaveLength(75);
    expect(catalog.map(({ id }) => id)).not.toContain('FA-01');
    expect(new Set(catalog.map(({ id }) => id)).size).toBe(75);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 's1',
                  studentSystemId: 'SCH-001',
                  firstNameEn: 'Erwin',
                  lastNameEn: 'Shrestha',
                  gender: 'MALE',
                  dateOfBirth: new Date('2010-01-01'),
                  admissionDate: new Date('2020-01-01'),
                  lifecycleStatus: 'ACTIVE',
                  class: { name: 'Grade 1' },
                  sectionRef: { name: 'A' },
                  section: 'A',
                  rollNumber: 1,
                },
              ]),
            },
            tenantSetting: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
            },
            enrollment: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'e1',
                  studentId: 's1',
                  academicYearId: 'ay1',
                  classId: 'c1',
                  sectionId: 'sec1',
                  rollNumber: 5,
                  admissionDate: new Date('2020-01-01'),
                  status: 'ACTIVE',
                  class: { name: 'Grade 1' },
                  section: { name: 'A' },
                  student: {
                    id: 's1',
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                    gender: 'MALE',
                    dateOfBirth: new Date('2010-01-01'),
                    guardianLinks: [
                      {
                        isPrimary: true,
                        guardian: {
                          fullName: 'Guardian Name',
                          primaryPhone: '9800000000',
                        },
                      },
                    ],
                  },
                },
              ]),
            },
            attendanceSession: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'as1',
                  attendanceDate: new Date('2024-05-01'),
                  records: [{ studentId: 's1', status: 'PRESENT' }],
                },
                {
                  id: 'as2',
                  attendanceDate: new Date('2024-05-02'),
                  records: [{ studentId: 's1', status: 'ABSENT' }],
                },
              ]),
            },
            reportExport: {
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn(),
            },
            payrollLine: {
              findMany: jest.fn().mockResolvedValue([
                {
                  grossSalary: 60000,
                  tds: 4500,
                  staff: {
                    employeeId: 'EMP-001',
                    firstName: 'Sita',
                    lastName: 'Rai',
                    panNumber: '123456789',
                  },
                },
              ]),
            },
            casRecord: {
              findMany: jest.fn().mockResolvedValue([
                {
                  student: {
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                  },
                  subject: {
                    code: 'ENG',
                    name: 'English',
                  },
                  category: 'PROJECT',
                  observedOn: new Date('2024-05-01'),
                  score: 8,
                  maxScore: 10,
                  note: 'Good',
                },
              ]),
            },
            reportCard: {
              findMany: jest.fn().mockResolvedValue([
                {
                  student: {
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                    rollNumber: 1,
                  },
                  class: { name: 'Grade 1' },
                  section: { name: 'A' },
                  percentage: 85.5,
                  grade: 'A',
                  gpa: 3.6,
                  status: 'LOCKED',
                  version: 1,
                },
              ]),
            },
            class: {
              findFirst: jest
                .fn()
                .mockResolvedValue({ id: 'c1', name: 'Grade 1' }),
            },
            section: {
              findFirst: jest.fn().mockResolvedValue({ id: 'sec1', name: 'A' }),
            },
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getStudentFeeLedger: jest.fn().mockResolvedValue({
              student: {
                studentSystemId: 'SCH-001',
                name: 'Erwin Shrestha',
                className: 'Grade 10',
                sectionName: 'A',
                guardianName: 'John Doe',
                guardianPhone: '9800000000',
              },
              rows: [
                {
                  date: new Date('2024-05-01'),
                  type: 'INVOICE',
                  reference: 'INV-001',
                  description: 'Tuition Fee',
                  debit: 1000,
                  credit: 0,
                  runningBalance: 1000,
                  invoiceNumber: 'INV-001',
                  receiptNumber: null,
                  status: 'ISSUED',
                },
              ],
            }),
            // FEE-01 export totals come from a single minimal page, since the
            // window totals are report-wide aggregates.
            getStudentFeeLedgerPage: jest.fn().mockResolvedValue({
              openingBalance: '0.00',
              totalInvoiced: '1000.00',
              totalPaid: '0.00',
              totalWaived: '0.00',
              totalRefunded: '0.00',
              outstandingBalance: '1000.00',
              windowTotals: { rowCount: 1, debit: '1000.00', credit: '0.00' },
              rows: [],
            }),
            // FEE-01 exports drain the enveloped projection, so the mock
            // mirrors that shape including backend-owned window totals.
            getStudentFeeLedgerExport: jest.fn().mockResolvedValue({
              student: {
                studentSystemId: 'SCH-001',
                name: 'Erwin Shrestha',
                className: 'Grade 10',
                sectionName: 'A',
                guardianName: 'John Doe',
                guardianPhone: '9800000000',
              },
              openingBalance: '0.00',
              totalInvoiced: '1000.00',
              totalPaid: '0.00',
              totalWaived: '0.00',
              totalRefunded: '0.00',
              outstandingBalance: '1000.00',
              windowTotals: {
                rowCount: 1,
                debit: '1000.00',
                credit: '0.00',
              },
              rows: [
                {
                  date: new Date('2024-05-01'),
                  type: 'INVOICE',
                  reference: 'INV-001',
                  description: 'Tuition Fee',
                  debit: '1000.00',
                  credit: '0.00',
                  runningBalance: '1000.00',
                  invoiceNumber: 'INV-001',
                  receiptNumber: null,
                  status: 'ISSUED',
                },
              ],
            }),
            getReceiptRegisterRows: jest.fn().mockResolvedValue({
              summary: {
                totalReceipts: 1,
                displayedReceipts: 1,
                totalAmount: '1000.00',
                totalRefundedAmount: '200.00',
                totalNetAmount: '800.00',
              },
            }),
            getReceiptRegisterExport: jest.fn().mockResolvedValue({
              rows: [
                {
                  receiptNumber: 'REC-001',
                  issuedAt: new Date('2026-07-01T00:00:00.000Z'),
                  studentSystemId: 'ST-001',
                  studentName: 'Asha Shrestha',
                  invoiceNumber: 'INV-001',
                  amount: '1000.00',
                  refundedAmount: '200.00',
                  netAmount: '800.00',
                  paymentMethod: 'CASH',
                  paymentStatus: 'SUCCESS',
                  cashierEmail: 'cashier@school.test',
                  reprintCount: 0,
                  latestReprintAt: null,
                },
              ],
            }),
            getRefundReversalRegisterRows: jest.fn().mockResolvedValue({
              summary: {
                totalRecords: 1,
                refundCount: 1,
                reversalCount: 0,
                totalAmount: '500.00',
              },
            }),
            getRefundReversalRegisterExport: jest.fn().mockResolvedValue({
              rows: [
                {
                  recordType: 'REFUND',
                  recordNumber: 'REF-001',
                  originalReceiptNumber: 'REC-001',
                  originalPaymentId: 'pay-1',
                  invoiceNumber: 'INV-001',
                  studentSystemId: 'ST-001',
                  studentName: 'Asha Shrestha',
                  amount: '500.00',
                  reason: 'Overpayment',
                  processedAt: new Date('2026-07-01T00:00:00.000Z'),
                  requestedByEmail: 'cashier@school.test',
                  approvedByEmail: 'accountant@school.test',
                  journalEntryNumber: 'JE-001',
                  reversalOfJournalEntryNumber: null,
                  status: 'COMPLETED',
                },
              ],
            }),
            getInvoiceRegisterRows: jest.fn().mockResolvedValue({
              summary: {
                totalInvoices: 1,
                displayedInvoices: 1,
                totalGrossAmount: '3500.00',
                totalNetAmount: '3500.00',
                totalPaidAmount: '3500.00',
                totalBalanceAmount: '0.00',
              },
            }),
            getInvoiceRegisterExport: jest.fn().mockResolvedValue({
              rows: [
                {
                  invoiceNumber: 'INV-001',
                  studentSystemId: 'ST-001',
                  studentName: 'Asha Shrestha',
                  className: 'Grade 10',
                  sectionName: 'A',
                  billingPeriod: '2026',
                  feeHeadNames: 'Tuition',
                  grossAmount: '3500.00',
                  discountAmount: '0.00',
                  netAmount: '3500.00',
                  paidAmount: '3500.00',
                  balanceAmount: '0.00',
                  dueDate: new Date('2026-07-01T00:00:00.000Z'),
                  issuedAt: new Date('2026-07-01T00:00:00.000Z'),
                  status: 'PAID',
                },
              ],
            }),
            getUnallocatedPaymentReport: jest.fn().mockResolvedValue({
              summary: {
                totalPayments: 1,
                totalUnallocatedAmount: '500.00',
                displayedUnallocatedAmount: '500.00',
              },
            }),
            getUnallocatedPaymentExport: jest.fn().mockResolvedValue({
              rows: [
                {
                  paymentId: 'pay-1',
                  receiptNumber: 'REC-001',
                  paymentDate: '2026-07-01T00:00:00.000Z',
                  studentSystemId: 'ST-001',
                  studentName: 'Asha Shrestha',
                  paymentMethod: 'CASH',
                  paymentStatus: 'SUCCESS',
                  referenceNumber: null,
                  originalAmount: '1500.00',
                  unallocatedBalance: '500.00',
                  balanceType: 'ADVANCE',
                  postingStatus: 'POSTED',
                  journalEntryNumber: 'JE-001',
                },
              ],
            }),
          },
        },
        {
          provide: AccountingReportsService,
          useValue: {
            getJournalRegister: jest.fn().mockResolvedValue({ rows: [] }),
            getFailedUnpostedTransactions: jest
              .fn()
              .mockResolvedValue({ rows: [], summary: { totalIssues: 0 } }),
          },
        },
        {
          provide: PayrollService,
          useValue: {
            getPayrollGlReconciliation: jest.fn().mockResolvedValue({
              rows: [],
              summary: { totalRuns: 0, reconciledRuns: 0, unreconciledRuns: 0 },
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        },
        {
          provide: FileRegistryService,
          useValue: {
            registerGeneratedFile: jest
              .fn()
              .mockResolvedValue({ id: 'file-1' }),
            getFileMetadata: jest.fn(),
            getProtectedDownload: jest.fn(),
          },
        },
        {
          provide: getQueueToken('reports'),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
        {
          provide: PlansService,
          useValue: {
            assertTenantActive: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TeacherScopeService,
          useValue: {
            requireActorAccess: jest.fn().mockResolvedValue({
              source: 'ASSIGNMENT',
              assignmentId: 'assignment-1',
            }),
            denyActorAccess: jest
              .fn()
              .mockRejectedValue(createTeacherScopeDeniedException()),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    fileRegistry = module.get<FileRegistryService>(FileRegistryService);
    plansService = module.get(PlansService);
    reportsQueue = module.get(getQueueToken('reports'));
    teacherScopeService = module.get(TeacherScopeService);
  });

  it('lists reports the user has permission to see', () => {
    const reports = service.listReports(actor);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.map((r) => r.key)).toContain('student-roster');
    expect(reports.map((r) => r.key)).toContain('class-roster');
    expect(reports.map((r) => r.key)).toContain('monthly-attendance-register');
    expect(reports.map((r) => r.key)).toContain('student-fee-ledger');
  });

  it('exposes the central cash-control reports to Accountant and financial_auditor only with both report permissions', () => {
    const CASH_CONTROL_REPORT_KEYS = [
      'cashier-close-report',
      'cash-deposit-report',
      'undeposited-collection-report',
      'cash-variance-report',
      'unallocated-payment-report',
    ];
    // Both presets carry reports:export + accounting:reports:read.
    const financePermissions = [
      'reports:read',
      'reports:export',
      'accounting:reports:read',
    ];

    for (const roles of [['accountant'], ['financial_auditor']]) {
      const keys = service
        .listReports({ ...actor, roles, permissions: financePermissions })
        .map((report) => report.key);
      for (const key of CASH_CONTROL_REPORT_KEYS) {
        expect(keys).toContain(key);
      }
    }

    // Missing accounting:reports:read must fail closed, export permission alone is not enough.
    const withoutAccountingReports = service
      .listReports({
        ...actor,
        roles: ['teacher'],
        permissions: ['reports:read', 'reports:export'],
      })
      .map((report) => report.key);
    for (const key of CASH_CONTROL_REPORT_KEYS) {
      expect(withoutAccountingReports).not.toContain(key);
    }

    // Missing reports:export must fail closed too.
    const withoutExport = service
      .listReports({
        ...actor,
        roles: ['principal'],
        permissions: ['reports:read', 'accounting:reports:read'],
      })
      .map((report) => report.key);
    for (const key of CASH_CONTROL_REPORT_KEYS) {
      expect(withoutExport).not.toContain(key);
    }
  });

  it('filters out reports user cannot access', () => {
    const restrictedActor = { ...actor, permissions: ['reports:read'] };
    const reports = service.listReports(restrictedActor);
    // monthly-attendance-register requires attendance:read
    expect(
      reports.find((r) => r.key === 'monthly-attendance-register'),
    ).toBeUndefined();
  });

  it('fails closed with a stable denial when a teacher report omits exact class and section scope', async () => {
    const teacherActor: AuthContext = {
      ...actor,
      roles: ['teacher'],
      permissions: ['students:read'],
    };

    await expect(
      service.exportReport(
        'student-roster',
        { format: 'json', filters: {} },
        teacherActor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: TEACHER_SCOPE_DENIED_CODE }),
    });

    expect(teacherScopeService.denyActorAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: TeacherCapability.CLASS_ROSTER_READ,
        reason: 'missing_scope',
      }),
      teacherActor,
    );
  });

  it('uses canonical homeroom scope for a teacher academic report', async () => {
    const teacherActor: AuthContext = {
      ...actor,
      roles: ['teacher'],
      permissions: ['academics:read', 'report_cards:read'],
    };

    await service.exportReport(
      'academic-report-card-status',
      {
        format: 'json',
        filters: {
          academicYearId: 'ay1',
          examTermId: 'term-1',
          classId: 'c1',
          sectionId: 'sec1',
        },
      },
      teacherActor,
    );

    expect(teacherScopeService.requireActorAccess).toHaveBeenCalledWith(
      {
        academicYearId: 'ay1',
        classId: 'c1',
        sectionId: 'sec1',
        capability: TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
        recordStatus: 'PUBLISHED',
      },
      teacherActor,
    );
  });

  it('blocks report exports for suspended tenants before queueing or generating files', async () => {
    plansService.assertTenantActive.mockRejectedValue(
      new ForbiddenException(SUSPENDED_TENANT_MESSAGE),
    );

    await expect(
      service.exportReport(
        'student-roster',
        { format: 'json', filters: {} },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(reportsQueue.add).not.toHaveBeenCalled();
  });

  it('exports monthly-attendance-register in CSV format', async () => {
    const result = await service.exportReport(
      'monthly-attendance-register',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
          month: 5,
          year: 2024,
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain('Student ID,Full Name,Class,Section');
    expect(csvString).toContain('Total School Days,Present Count,Absent Count');
    expect(csvString).toContain('"SCH-001","Erwin Shrestha","Grade 1"');
    // Daily columns
    expect(csvString).toContain('D01,D02');
    expect(csvString).toContain('"PRESENT","ABSENT"');
    expect(audit.record).toHaveBeenCalled();
  });

  it('enforces tenant scoping during attendance queries', async () => {
    await service.exportReport(
      'monthly-attendance-register',
      {
        format: 'json',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
          month: 5,
          year: 2024,
        },
      },
      actor,
    );

    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
        }),
      }),
    );
  });

  it('throws ForbiddenException for missing required filters', async () => {
    await expect(
      service.exportReport(
        'monthly-attendance-register',
        {
          format: 'json',
          filters: { month: 5, year: 2024 },
        },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('exports student-fee-ledger in CSV format', async () => {
    const result = await service.exportReport(
      'student-fee-ledger',
      {
        format: 'csv',
        filters: {
          studentId: 's1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student Name,Class,Section,Guardian Name,Guardian Phone',
    );
    expect(csvString).toContain('Date,Type,Reference,Description,Debit,Credit');
    expect(csvString).toContain(
      '"SCH-001","Erwin Shrestha","Grade 10","A","John Doe","9800000000"',
    );
    expect(csvString).toContain('"2024-05-01","INVOICE","INV-001"');
    expect(audit.record).toHaveBeenCalled();
  });

  it('records the FEE-01 export with catalog-owned metadata matching the rendered envelope', async () => {
    await service.exportReport(
      'student-fee-ledger',
      {
        format: 'csv',
        filters: { studentId: 's1', toDate: '2026-06-30', fromDate: undefined },
      },
      actor,
    );

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'student-fee-ledger',
          // The registry key is a route slug; this is the catalog linkage.
          financialReportId: 'FEE-01',
          definitionVersion: FINANCIAL_REPORT_DEFINITION_VERSION,
          classification: 'CONFIDENTIAL',
        }),
      }),
    );

    const recorded = (prisma.reportExport.create as jest.Mock).mock
      .calls[0][0] as {
      data: {
        normalizedParameters: Record<string, unknown>;
        watermark: string;
        displayedTotals: Record<string, string>;
        rowCount: number;
      };
    };
    // Displayed-total parity: the stored artifact records the same
    // backend-owned window totals the rendered report shows, and the row count
    // it claims matches the rows actually written.
    expect(recorded.data.displayedTotals).toEqual({
      rowCount: '1',
      debit: '1000.00',
      credit: '0.00',
      openingBalance: '0.00',
      totalInvoiced: '1000.00',
      totalPaid: '0.00',
      totalWaived: '0.00',
      totalRefunded: '0.00',
      outstandingBalance: '1000.00',
    });
    expect(String(recorded.data.rowCount)).toBe(
      recorded.data.displayedTotals.rowCount,
    );
    // Same normalization rule as the rendered envelope: undefined dropped, keys sorted.
    expect(Object.keys(recorded.data.normalizedParameters)).toEqual([
      'studentId',
      'toDate',
    ]);
    expect(recorded.data.watermark).toContain('CONFIDENTIAL');
  });

  it('classifies a statutory report as STATUTORY_DRAFT once it is linked to the catalog', () => {
    // Regression guard: metadata used to be keyed off the registry slug, which
    // never equals a catalog ID, so every export -- including TDS and tax
    // reports -- was silently classified CONFIDENTIAL.
    const buildExportMetadata = (
      service as unknown as {
        buildExportMetadata: (
          definition: { key: string; financialReportId?: string },
          filters: Record<string, unknown>,
          actor: AuthContext,
        ) => { financialReportId: string | null; classification: string };
      }
    ).buildExportMetadata.bind(service);

    // Asserted through the real registry entry, not a synthetic definition, so
    // the link itself is covered rather than just the resolution helper.
    const tdsExecutor = service.registry.get('statutory-tds-summary');
    expect(tdsExecutor?.definition.financialReportId).toBe('TAX-01');

    expect(buildExportMetadata(tdsExecutor!.definition, {}, actor)).toEqual(
      expect.objectContaining({
        financialReportId: 'TAX-01',
        classification: 'STATUTORY_DRAFT',
      }),
    );

    // Statutory output must be watermarked as a draft, so a generated artifact
    // is never presented as final before Nepal-qualified review exists.
    expect(
      buildExportMetadata(tdsExecutor!.definition, {}, actor).watermark,
    ).toContain('STATUTORY DRAFT');

    // An unlinked, non-financial export stays confidential with no catalog id.
    expect(buildExportMetadata({ key: 'student-roster' }, {}, actor)).toEqual(
      expect.objectContaining({
        financialReportId: null,
        classification: 'CONFIDENTIAL',
      }),
    );
  });

  it('marks the exported statutory TDS artifact as a draft inside the document', async () => {
    const result = await service.exportReport(
      'statutory-tds-summary',
      { format: 'pdf', filters: { month: '5', year: '2026' } },
      { ...actor, permissions: [...actor.permissions, 'payroll:read'] },
    );

    const pdf = (result.content as Buffer).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    // Nepal-qualified review is external, so the artifact itself must say so
    // rather than relying on metadata a downloaded file does not carry.
    expect(pdf).toContain('STATUTORY DRAFT');
    expect(pdf).not.toContain('CONFIDENTIAL');

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          financialReportId: 'TAX-01',
          classification: 'STATUTORY_DRAFT',
        }),
      }),
    );
  });

  it('records which catalog reports still have no registered export', () => {
    // PAY-04 (Tax Deduction Report) and TAX-02 (TDS Payable Report) are in the
    // P0 catalog but have no implementation, so there is nothing to link. This
    // pins that gap rather than letting a future reader assume they are wired.
    const linked = new Set(
      Array.from(service.registry.values())
        .map((executor) => executor.definition.financialReportId)
        .filter(Boolean),
    );

    expect(linked.has('TAX-01')).toBe(true);
    expect(linked.has('FEE-15')).toBe(true);
    expect(linked.has('FEE-17')).toBe(true);
    expect(linked.has('AR-01')).toBe(true);
    expect(linked.has('AR-06')).toBe(true);
    expect(linked.has('PAY-04')).toBe(false);
    expect(linked.has('TAX-02')).toBe(false);
  });

  it('links FEE-15 and FEE-17 registry entries to the financial report catalog', () => {
    expect(findFinancialReportDefinition('FEE-15')?.id).toBe('FEE-15');
    expect(findFinancialReportDefinition('FEE-17')?.id).toBe('FEE-17');
    expect(findFinancialReportDefinition('AR-01')?.id).toBe('AR-01');
    expect(findFinancialReportDefinition('AR-06')?.id).toBe('AR-06');
    expect(service.registry.get('refund-reversal-report')?.definition).toEqual(
      expect.objectContaining({ financialReportId: 'FEE-15' }),
    );
    expect(service.registry.get('receipt-register')?.definition).toEqual(
      expect.objectContaining({ financialReportId: 'FEE-17' }),
    );
    expect(service.registry.get('invoice-register')?.definition).toEqual(
      expect.objectContaining({ financialReportId: 'AR-01' }),
    );
    expect(
      service.registry.get('unallocated-payment-report')?.definition,
    ).toEqual(expect.objectContaining({ financialReportId: 'AR-06' }));
  });

  it('records the FEE-17 export with catalog-owned metadata and displayed totals', async () => {
    await service.exportReport(
      'receipt-register',
      { format: 'csv', filters: { fromDate: '2026-07-01' } },
      actor,
    );

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'receipt-register',
          financialReportId: 'FEE-17',
          definitionVersion: FINANCIAL_REPORT_DEFINITION_VERSION,
          classification: 'CONFIDENTIAL',
        }),
      }),
    );

    const recorded = (prisma.reportExport.create as jest.Mock).mock.calls.at(
      -1,
    )?.[0] as {
      data: {
        displayedTotals: Record<string, string>;
        rowCount: number;
        watermark: string;
      };
    };
    expect(recorded.data.displayedTotals).toEqual({
      rowCount: '1',
      totalAmount: '1000.00',
      totalRefundedAmount: '200.00',
      totalNetAmount: '800.00',
    });
    expect(String(recorded.data.rowCount)).toBe(
      recorded.data.displayedTotals.rowCount,
    );
    expect(recorded.data.watermark).toContain('CONFIDENTIAL');
  });

  it('records the FEE-15 export with catalog-owned metadata and displayed totals', async () => {
    await service.exportReport(
      'refund-reversal-report',
      { format: 'csv', filters: { toDate: '2026-07-31' } },
      actor,
    );

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'refund-reversal-report',
          financialReportId: 'FEE-15',
          definitionVersion: FINANCIAL_REPORT_DEFINITION_VERSION,
          classification: 'CONFIDENTIAL',
        }),
      }),
    );

    const recorded = (prisma.reportExport.create as jest.Mock).mock.calls.at(
      -1,
    )?.[0] as {
      data: {
        displayedTotals: Record<string, string>;
        rowCount: number;
      };
    };
    expect(recorded.data.displayedTotals).toEqual({
      rowCount: '1',
      refundCount: '1',
      reversalCount: '0',
      totalAmount: '500.00',
    });
    expect(String(recorded.data.rowCount)).toBe(
      recorded.data.displayedTotals.rowCount,
    );
  });

  it('carries FEE-17 watermark and control totals inside PDF and XLSX artifacts', async () => {
    const pdfResult = await service.exportReport(
      'receipt-register',
      { format: 'pdf', filters: {} },
      actor,
    );
    const pdf = (pdfResult.content as Buffer).toString('latin1');
    expect(pdf).toContain('CONFIDENTIAL');
    expect(pdf).toContain('CONTROL TOTALS');
    expect(pdf).toContain('TOTALAMOUNT');
    expect(pdf).toContain('1000.00');
    expect(pdf).toContain('Rows in export: 1');

    const xlsxResult = await service.exportReport(
      'receipt-register',
      { format: 'xlsx', filters: {} },
      actor,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Uint8Array.from(xlsxResult.content as Buffer).buffer,
    );
    const metadata = new Map<string, unknown>();
    workbook.getWorksheet('Report Metadata')?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      metadata.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(String(metadata.get('Classification'))).toContain('CONFIDENTIAL');
    expect(metadata.get('totalAmount')).toBe('1000.00');
    expect(metadata.get('rowCount')).toBe('1');
  });

  it('carries FEE-15 watermark and control totals inside PDF and XLSX artifacts', async () => {
    const pdfResult = await service.exportReport(
      'refund-reversal-report',
      { format: 'pdf', filters: {} },
      actor,
    );
    const pdf = (pdfResult.content as Buffer).toString('latin1');
    expect(pdf).toContain('CONFIDENTIAL');
    expect(pdf).toContain('CONTROL TOTALS');
    expect(pdf).toContain('TOTALAMOUNT');
    expect(pdf).toContain('500.00');

    const xlsxResult = await service.exportReport(
      'refund-reversal-report',
      { format: 'xlsx', filters: {} },
      actor,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Uint8Array.from(xlsxResult.content as Buffer).buffer,
    );
    const metadata = new Map<string, unknown>();
    workbook.getWorksheet('Report Metadata')?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      metadata.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(String(metadata.get('Classification'))).toContain('CONFIDENTIAL');
    expect(metadata.get('totalAmount')).toBe('500.00');
    expect(metadata.get('refundCount')).toBe('1');
  });

  it('fails FEE-17 export metadata when the catalog link is removed', () => {
    const buildExportMetadata = (
      service as unknown as {
        buildExportMetadata: (
          definition: { key: string; financialReportId?: string },
          filters: Record<string, unknown>,
          actor: AuthContext,
        ) => { financialReportId: string | null; classification: string };
      }
    ).buildExportMetadata.bind(service);

    const receiptExecutor = service.registry.get('receipt-register');
    expect(buildExportMetadata(receiptExecutor!.definition, {}, actor)).toEqual(
      expect.objectContaining({
        financialReportId: 'FEE-17',
        classification: 'CONFIDENTIAL',
      }),
    );

    expect(
      buildExportMetadata(
        { ...receiptExecutor!.definition, financialReportId: undefined },
        {},
        actor,
      ),
    ).toEqual(
      expect.objectContaining({
        financialReportId: null,
        classification: 'CONFIDENTIAL',
      }),
    );
  });

  it('records the AR-01 export with catalog-owned metadata and displayed totals', async () => {
    await service.exportReport(
      'invoice-register',
      { format: 'csv', filters: { fromDate: '2026-07-01' } },
      actor,
    );

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'invoice-register',
          financialReportId: 'AR-01',
          classification: 'CONFIDENTIAL',
        }),
      }),
    );

    const recorded = (prisma.reportExport.create as jest.Mock).mock.calls.at(
      -1,
    )?.[0] as {
      data: {
        displayedTotals: Record<string, string>;
        rowCount: number;
      };
    };
    expect(recorded.data.displayedTotals).toEqual({
      rowCount: '1',
      totalGrossAmount: '3500.00',
      totalNetAmount: '3500.00',
      totalPaidAmount: '3500.00',
      totalBalanceAmount: '0.00',
    });
    expect(String(recorded.data.rowCount)).toBe(
      recorded.data.displayedTotals.rowCount,
    );
  });

  it('records the AR-06 export with catalog-owned metadata and displayed totals', async () => {
    await service.exportReport(
      'unallocated-payment-report',
      { format: 'csv', filters: {} },
      {
        ...actor,
        permissions: [...actor.permissions, 'accounting:reports:read'],
      },
    );

    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'unallocated-payment-report',
          financialReportId: 'AR-06',
          classification: 'CONFIDENTIAL',
        }),
      }),
    );

    const recorded = (prisma.reportExport.create as jest.Mock).mock.calls.at(
      -1,
    )?.[0] as {
      data: {
        displayedTotals: Record<string, string>;
        rowCount: number;
      };
    };
    expect(recorded.data.displayedTotals).toEqual({
      rowCount: '1',
      totalPayments: '1',
      totalUnallocatedAmount: '500.00',
    });
    expect(String(recorded.data.rowCount)).toBe(
      recorded.data.displayedTotals.rowCount,
    );
  });

  it('carries AR-01 watermark and control totals inside PDF and XLSX artifacts', async () => {
    const pdfResult = await service.exportReport(
      'invoice-register',
      { format: 'pdf', filters: {} },
      actor,
    );
    const pdf = (pdfResult.content as Buffer).toString('latin1');
    expect(pdf).toContain('CONFIDENTIAL');
    expect(pdf).toContain('CONTROL TOTALS');
    expect(pdf).toContain('TOTALNETAMO');
    expect(pdf).toContain('3500.00');

    const xlsxResult = await service.exportReport(
      'invoice-register',
      { format: 'xlsx', filters: {} },
      actor,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Uint8Array.from(xlsxResult.content as Buffer).buffer,
    );
    const metadata = new Map<string, unknown>();
    workbook.getWorksheet('Report Metadata')?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      metadata.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(String(metadata.get('Classification'))).toContain('CONFIDENTIAL');
    expect(metadata.get('totalNetAmount')).toBe('3500.00');
    expect(metadata.get('rowCount')).toBe('1');
  });

  it('carries AR-06 watermark and control totals inside PDF and XLSX artifacts', async () => {
    const financeActor = {
      ...actor,
      permissions: [...actor.permissions, 'accounting:reports:read'],
    };
    const pdfResult = await service.exportReport(
      'unallocated-payment-report',
      { format: 'pdf', filters: {} },
      financeActor,
    );
    const pdf = (pdfResult.content as Buffer).toString('latin1');
    expect(pdf).toContain('CONFIDENTIAL');
    expect(pdf).toContain('CONTROL TOTALS');
    expect(pdf).toContain('TOTALUNALLOCATEDAMO');
    expect(pdf).toContain('500.00');

    const xlsxResult = await service.exportReport(
      'unallocated-payment-report',
      { format: 'xlsx', filters: {} },
      financeActor,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Uint8Array.from(xlsxResult.content as Buffer).buffer,
    );
    const metadata = new Map<string, unknown>();
    workbook.getWorksheet('Report Metadata')?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      metadata.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(String(metadata.get('Classification'))).toContain('CONFIDENTIAL');
    expect(metadata.get('totalUnallocatedAmount')).toBe('500.00');
    expect(metadata.get('rowCount')).toBe('1');
  });

  it('exports finance reports as a real XLSX workbook', async () => {
    const result = await service.exportReport(
      'student-fee-ledger',
      {
        format: 'xlsx',
        filters: { studentId: 's1' },
      },
      actor,
    );

    expect(result.format).toBe('xlsx');
    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const workbook = new ExcelJS.Workbook();
    const workbookBytes = Uint8Array.from(result.content as Buffer).buffer;
    await workbook.xlsx.load(workbookBytes);
    const worksheet = workbook.getWorksheet('Report');
    expect(worksheet?.getCell('A1').value).toBe('Student ID');
    expect(worksheet?.getCell('A2').value).toBe('SCH-001');
  });

  it('carries the classification watermark and control totals inside the XLSX artifact', async () => {
    const result = await service.exportReport(
      'student-fee-ledger',
      { format: 'xlsx', filters: { studentId: 's1' } },
      actor,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(result.content as Buffer).buffer);

    // The data grid still starts at row 1 so it stays machine-readable.
    expect(workbook.getWorksheet('Report')?.getCell('A1').value).toBe(
      'Student ID',
    );

    const metaSheet = workbook.getWorksheet('Report Metadata');
    expect(metaSheet).toBeDefined();

    const metadata = new Map<string, unknown>();
    metaSheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      metadata.set(String(row.getCell(1).value), row.getCell(2).value);
    });

    expect(String(metadata.get('Classification'))).toContain('CONFIDENTIAL');
    expect(String(metadata.get('Classification'))).toContain(actor.tenantSlug);
    // Backend-owned totals travel inside the file, not just beside it.
    expect(metadata.get('outstandingBalance')).toBe('1000.00');
    expect(metadata.get('totalInvoiced')).toBe('1000.00');
    expect(metadata.get('rowCount')).toBe('1');
  });

  it('carries the classification watermark and control totals inside the PDF artifact', async () => {
    const result = await service.exportReport(
      'student-fee-ledger',
      { format: 'pdf', filters: { studentId: 's1' } },
      actor,
    );

    expect(result.contentType).toBe('application/pdf');
    const pdf = (result.content as Buffer).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);

    // Text is drawn as literal PDF strings, so the marking is assertable.
    expect(pdf).toContain('CONFIDENTIAL');
    expect(pdf).toContain('CONTROL TOTALS');
    expect(pdf).toContain('OUTSTANDINGBALANCE');
    expect(pdf).toContain('1000.00');
    expect(pdf).toContain('Rows in export: 1');
  });

  it('exports academic-cas-summary in CSV format', async () => {
    const result = await service.exportReport(
      'academic-cas-summary',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student,Subject,Category,Observed On,Score,Max Score,Percentage,Note',
    );
    expect(csvString).toContain('"SCH-001","Erwin Shrestha","ENG - English"');
    expect(csvString).toContain(
      '"PROJECT","2024-05-01","8","10","80.00","Good"',
    );
  });

  it('exports academic-promotion-readiness in CSV format', async () => {
    const result = await service.exportReport(
      'academic-promotion-readiness',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          examTermId: 'et1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student,Class,Section,Roll Number,Percentage,Grade,GPA,Promotion Eligible,Status,Version',
    );
    expect(csvString).toContain(
      '"SCH-001","Erwin Shrestha","Grade 1","A","1","85.50","A","3.60","YES","LOCKED","1"',
    );
  });

  it('completes queued exports with a protected File Registry snapshot', async () => {
    await service.completeQueuedExport({
      exportId: 'export-1',
      reportKey: 'student-roster',
      filters: { status: 'ACTIVE' },
      format: 'csv',
      actor,
    });

    expect(fileRegistry.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: 'student-roster.csv',
        mimeType: 'text/csv',
        module: 'reports',
        metadata: expect.objectContaining({
          module: 'students',
          reportKey: 'student-roster',
          format: 'csv',
          filters: { status: 'ACTIVE' },
        }),
      }),
    );
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        errorSummary: null,
        fileAssetId: 'file-1',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export_report',
        resource: 'report',
        resourceId: 'student-roster',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: expect.objectContaining({
          async: true,
          fileAssetId: 'file-1',
        }),
      }),
    );
  });

  it('embeds the configured school logo in table report PDFs', async () => {
    const logoBytes = await createTestLogoJpeg();
    (prisma.tenantSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      value: SCHOOL_LOGO_FILE_ASSET_ID,
    });
    (fileRegistry.getFileMetadata as jest.Mock).mockResolvedValueOnce({
      id: SCHOOL_LOGO_FILE_ASSET_ID,
      tenantId: actor.tenantId,
      module: 'settings',
      entityId: actor.tenantId,
      status: FileStatus.UPLOADED,
      originalFilename: 'school-logo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(logoBytes.length),
      metadata: { kind: 'SCHOOL_LOGO' },
    });
    (fileRegistry.getProtectedDownload as jest.Mock).mockResolvedValueOnce({
      content: logoBytes,
    });

    const result = await service.exportReport(
      'academic-class-result-summary',
      {
        format: 'pdf',
        filters: { academicYearId: 'ay1', examTermId: 'et1' },
      },
      actor,
    );

    const pdf = result.content as Buffer;
    expect(pdf.toString('latin1')).toContain('/Filter /DCTDecode');
  });

  it('still generates table report PDFs when no school logo is configured', async () => {
    const result = await service.exportReport(
      'academic-class-result-summary',
      {
        format: 'pdf',
        filters: { academicYearId: 'ay1', examTermId: 'et1' },
      },
      actor,
    );

    const pdf = result.content as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('/Filter /DCTDecode');
  });

  it('lists export history with tenant scope and safe pagination bounds', async () => {
    (prisma.reportExport.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'export-1', tenantId: actor.tenantId },
    ]);
    (prisma.reportExport.count as jest.Mock).mockResolvedValueOnce(250);

    const result = await service.getExportHistory(actor, {
      page: '-5',
      limit: '500',
    });

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        reportKey: { in: expect.arrayContaining(['student-roster']) },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 100,
    });
    expect(prisma.reportExport.count).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        reportKey: { in: expect.arrayContaining(['student-roster']) },
      },
    });
    expect(result).toEqual({
      items: [{ id: 'export-1', tenantId: actor.tenantId }],
      total: 250,
      page: 1,
      limit: 100,
      hasNextPage: true,
    });
  });

  it('retries failed exports with original filters and tenant scope', async () => {
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-roster',
      format: 'csv',
      filters: { status: 'ACTIVE' },
      status: 'FAILED',
    });

    const result = await service.retryExport('export-1', actor);

    expect(prisma.reportExport.findFirst).toHaveBeenCalledWith({
      where: { id: 'export-1', tenantId: actor.tenantId },
    });
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: {
        status: 'QUEUED',
        errorSummary: null,
        failureDetail: null,
        completedAt: null,
        requestedBy: actor.userId,
      },
    });
    expect(reportsQueue.add).toHaveBeenCalledWith('generateReport', {
      exportId: 'export-1',
      reportKey: 'student-roster',
      filters: { status: 'ACTIVE' },
      format: 'csv',
      actor,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_report_export',
        resource: 'report_export',
        resourceId: 'export-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
    expect(result).toEqual({
      id: 'export-1',
      status: 'QUEUED',
      jobId: 'job-1',
    });
  });

  it('does not retry completed exports', async () => {
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-roster',
      format: 'csv',
      filters: {},
      status: 'COMPLETED',
    });

    await expect(service.retryExport('export-1', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.reportExport.update).not.toHaveBeenCalled();
    expect(reportsQueue.add).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retry_report_export' }),
    );
  });

  it('revalidates permissions and checksum when downloading an export', async () => {
    const content = Buffer.from('protected finance export');
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-fee-ledger',
      format: 'csv',
      status: 'COMPLETED',
      fileAssetId: 'file-1',
      checksum: createHash('sha256').update(content).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
    });
    (fileRegistry.getProtectedDownload as jest.Mock).mockResolvedValueOnce({
      asset: {
        originalFilename: 'student-fee-ledger.csv',
        mimeType: 'text/csv',
      },
      content,
    });

    const result = await service.downloadExportSnapshot('export-1', actor);

    expect(result.content).toEqual(content);
    expect(fileRegistry.getProtectedDownload).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
      actor.userId,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'download_report_snapshot',
        resourceId: 'export-1',
      }),
    );
  });

  it('denies an expired protected report snapshot', async () => {
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-fee-ledger',
      format: 'csv',
      status: 'COMPLETED',
      fileAssetId: 'file-1',
      checksum: 'not-used',
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      service.downloadExportSnapshot('export-1', actor),
    ).rejects.toThrow('expired');
    expect(fileRegistry.getProtectedDownload).not.toHaveBeenCalled();
  });
});

function expectBufferText(content: unknown) {
  expect(Buffer.isBuffer(content)).toBe(true);
  return (content as Buffer).toString();
}

const SCHOOL_LOGO_FILE_ASSET_ID = '11111111-1111-1111-1111-111111111111';

function createTestLogoJpeg() {
  return sharp({
    create: {
      width: 96,
      height: 48,
      channels: 3,
      background: { r: 24, g: 84, b: 140 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
