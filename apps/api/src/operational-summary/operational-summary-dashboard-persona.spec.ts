import { AuthMethod } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../plans/entitlements.service';
import { OperationalSummaryService } from './operational-summary.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';

function createFlexiblePrismaMock(): PrismaService {
  const handler = {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({
      _sum: { amount: null, totalAmount: null },
    }),
    findFirst: jest.fn().mockResolvedValue(null),
  };

  return new Proxy({} as PrismaService, {
    get(_target, prop: string | symbol) {
      if (prop === 'then') return undefined;
      return handler;
    },
  });
}

describe('OperationalSummaryService dashboard persona projection', () => {
  const entitlements = {
    getEntitlements: jest.fn(),
  } as unknown as jest.Mocked<Pick<EntitlementsService, 'getEntitlements'>>;

  const teacherScopeService = {
    resolveActiveStaffId: jest.fn().mockResolvedValue('staff-1'),
    listActiveAssignments: jest.fn().mockResolvedValue([]),
  };

  let service: OperationalSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    entitlements.getEntitlements.mockResolvedValue({
      modules: [
        'students',
        'attendance',
        'fees',
        'exams',
        'activity',
        'homework',
        'hr',
        'library',
        'transport',
        'canteen',
        'accounting',
        'notices',
        'learning',
      ],
    } as never);
    service = new OperationalSummaryService(
      createFlexiblePrismaMock(),
      entitlements as unknown as EntitlementsService,
      teacherScopeService as unknown as TeacherScopeService,
    );
  });

  it('returns an admin-scoped dashboard projection from authenticated context', async () => {
    const admin: AuthContext = {
      userId: 'admin-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'admin@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: [
        'students:read',
        'attendance:read',
        'fees:read',
        'notices:read',
        'homework:read',
        'staff:read',
      ],
    };

    const summary = await service.getDashboardSummary(admin);

    expect(summary.compositionPersona).toBe('admin');
    expect(summary.modules.map((module) => module.module)).toEqual(
      expect.arrayContaining(['m1_students', 'm2_attendance', 'm3_fees']),
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm4_academics',
    );
    expect(summary).not.toHaveProperty('cashierClose');
  });

  it('returns a principal-scoped dashboard projection without admin admissions modules', async () => {
    const principal: AuthContext = {
      userId: 'principal-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'principal@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['principal'],
      permissions: [
        'students:read',
        'attendance:read',
        'fees:read',
        'academics:read',
        'notices:read',
        'staff:read',
      ],
    };

    const summary = await service.getDashboardSummary(principal);

    expect(summary.compositionPersona).toBe('principal');
    expect(summary.modules.map((module) => module.module)).toEqual(
      expect.arrayContaining(['m4_academics', 'm2_attendance']),
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm1_students',
    );
    expect(summary).not.toHaveProperty('applicationsNeedingReview');
  });

  it('fails closed for teacher personas on the school dashboard summary', async () => {
    const teacher: AuthContext = {
      userId: 'teacher-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    };

    await expect(service.getDashboardSummary(teacher)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns an hr-scoped dashboard projection without admissions or academics modules', async () => {
    const hr: AuthContext = {
      userId: 'hr-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'hr@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['hr_manager'],
      permissions: ['staff:read', 'payroll:read', 'attendance:read', 'notices:read'],
    };

    const summary = await service.getDashboardSummary(hr);

    expect(summary.compositionPersona).toBe('hr');
    expect(summary.modules.map((module) => module.module)).toEqual(
      expect.arrayContaining(['m7_hr_payroll', 'm2_attendance', 'm10_communications']),
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm1_students',
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm4_academics',
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm9_accounting',
    );
  });

  it('returns an accountant-scoped dashboard projection with fees and accounting modules', async () => {
    const accountant: AuthContext = {
      userId: 'accountant-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'accountant@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['accountant'],
      permissions: [
        'fees:read',
        'accounting:read',
        'payroll:read',
        'notices:read',
      ],
    };

    const summary = await service.getDashboardSummary(accountant);

    expect(summary.compositionPersona).toBe('accountant');
    expect(summary.modules.map((module) => module.module)).toEqual(
      expect.arrayContaining(['m3_fees', 'm9_accounting', 'm7_hr_payroll']),
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm1_students',
    );
    expect(summary.modules.map((module) => module.module)).not.toContain(
      'm4_academics',
    );
  });

  it('fails closed for librarian and cashier personas on the school dashboard summary', async () => {
    const librarian: AuthContext = {
      userId: 'librarian-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'librarian@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['librarian'],
      permissions: ['library:read'],
    };
    const cashier: AuthContext = {
      userId: 'cashier-1',
      tenantId: 'tenant-a',
      tenantSlug: 'tenant-a-school',
      email: 'cashier@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['cashier'],
      permissions: ['payments:collect', 'payments:close'],
    };

    await expect(service.getDashboardSummary(librarian)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.getDashboardSummary(cashier)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('scopes module queries to the authenticated tenant', async () => {
    const countMock = jest.fn().mockResolvedValue(0);
    const prisma = new Proxy({} as PrismaService, {
      get(_target, prop: string | symbol) {
        if (prop === 'then') return undefined;
        return {
          count: countMock,
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn().mockResolvedValue({
            _sum: { amount: null, totalAmount: null },
          }),
          findFirst: jest.fn().mockResolvedValue(null),
        };
      },
    });
    service = new OperationalSummaryService(
      prisma,
      entitlements as unknown as EntitlementsService,
      teacherScopeService as unknown as TeacherScopeService,
    );

    const admin: AuthContext = {
      userId: 'admin-1',
      tenantId: 'tenant-scope-a',
      tenantSlug: 'tenant-a-school',
      email: 'admin@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['students:read', 'admissions:read'],
    };

    await service.getDashboardSummary(admin);

    expect(countMock).toHaveBeenCalled();
    expect(
      countMock.mock.calls.some(
        ([input]) => input?.where?.tenantId === 'tenant-scope-a',
      ),
    ).toBe(true);
  });
});
