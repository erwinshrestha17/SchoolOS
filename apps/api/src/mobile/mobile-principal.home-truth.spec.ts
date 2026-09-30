import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobilePrincipalService } from './mobile-principal.service';

/**
 * Phase 4 (4-S1): the principal home must be permission-safe and truthful —
 * panels the actor may not open are withheld (not zeroed), failing panels are
 * reported as unavailable, counts are exact and SoD-aware, and "today" is the
 * Nepal school day.
 */
describe('MobilePrincipalService home truthfulness (Phase 4)', () => {
  const baseActor: AuthContext = {
    userId: 'principal-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: ['students:read', 'attendance:read', 'notices:read'],
  };

  const withPermissions = (...permissions: string[]): AuthContext => ({
    ...baseActor,
    permissions: [...baseActor.permissions, ...permissions],
  });

  function makePrisma() {
    return {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          name: 'School',
          isActive: true,
        }),
      },
      class: { findMany: jest.fn().mockResolvedValue([]) },
      section: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceSession: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceCorrectionRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      staffAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      staffLeaveRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      timetableSubstitution: { findMany: jest.fn().mockResolvedValue([]) },
      reportCardCorrectionRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      approvalRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notice: { findMany: jest.fn().mockResolvedValue([]) },
      reportCard: { count: jest.fn().mockResolvedValue(0) },
      student: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ count: 0n }]),
    };
  }

  function makeService(
    prisma: ReturnType<typeof makePrisma>,
    modules: string[],
  ) {
    const entitlements = {
      getEntitlements: jest.fn().mockResolvedValue({ modules, features: [] }),
    };
    const approvalWorkflow = {
      registerFinalAction: jest.fn(),
    };
    return new MobilePrincipalService(
      prisma as never,
      entitlements as never,
      approvalWorkflow as never,
      {} as never,
      {} as never,
      {} as never,
      { listManagerRequests: jest.fn() } as never,
    );
  }

  it('withholds panels the actor cannot open instead of reporting zero', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, ['attendance', 'hr', 'fees']);

    const dashboard = await service.getDashboard(baseActor);
    const byKey = Object.fromEntries(
      dashboard.cards.map((card) => [card.key, card]),
    );

    for (const key of ['staffAbsence', 'fees', 'approvals']) {
      expect(byKey[key]).toMatchObject({
        value: null,
        available: false,
        unavailableReason: 'NOT_PERMITTED',
        tone: 'gray',
      });
    }
    expect(byKey.attendanceRisk).toMatchObject({ available: true });
    expect(prisma.staffAttendance.findMany).not.toHaveBeenCalled();
  });

  it('reports a failing panel as unavailable, never as zero', async () => {
    const prisma = makePrisma();
    prisma.staffAttendance.findMany.mockRejectedValue(new Error('timeout'));
    const service = makeService(prisma, ['hr']);

    const dashboard = await service.getDashboard(
      withPermissions('staff:read', 'hr:leave:approve'),
    );
    const staff = dashboard.cards.find((card) => card.key === 'staffAbsence');

    expect(staff).toMatchObject({
      value: null,
      available: false,
      unavailableReason: 'UNAVAILABLE',
    });
  });

  it('counts only approvals the actor may decide (SoD, step and delegation)', async () => {
    const prisma = makePrisma();
    prisma.staffLeaveRequest.count.mockResolvedValue(2);
    prisma.approvalRequest.findMany.mockResolvedValue([
      // current step is for principals → decidable
      {
        delegatedToId: null,
        steps: [{ approverRole: 'principal', approverPermission: null }],
      },
      // current step is for accountants → not decidable
      {
        delegatedToId: null,
        steps: [{ approverRole: 'accountant', approverPermission: null }],
      },
      // delegated to someone else → not decidable
      {
        delegatedToId: 'other-user',
        steps: [{ approverRole: 'principal', approverPermission: null }],
      },
    ]);
    const service = makeService(prisma, []);

    const dashboard = await service.getDashboard(
      withPermissions(
        'advanced:approvals:read',
        'advanced:approvals:decide',
        'hr:leave:approve',
      ),
    );
    const approvals = dashboard.cards.find((card) => card.key === 'approvals');

    expect(approvals).toMatchObject({ value: 3, available: true });
    expect(prisma.staffLeaveRequest.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: 'PENDING',
        staff: { userId: { not: 'principal-user-1' } },
      },
    });
    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestedById: { not: 'principal-user-1' },
        }),
      }),
    );
    // No attendance-correction review permission → queue not counted at all.
    expect(prisma.attendanceCorrectionRequest.count).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestedById: expect.anything() }),
      }),
    );
  });

  it('counts each absent staff member once and excludes pending leave and late arrivals', async () => {
    const prisma = makePrisma();
    const staff = (id: string) => ({
      id,
      firstName: id,
      lastName: 'Staff',
      designation: null,
      department: null,
    });
    prisma.staffAttendance.findMany.mockResolvedValue([
      {
        id: 'a1',
        staffId: 's1',
        status: 'ABSENT',
        staff: staff('s1'),
        createdAt: new Date(),
      },
      {
        id: 'a2',
        staffId: 's2',
        status: 'LATE',
        staff: staff('s2'),
        createdAt: new Date(),
      },
    ]);
    prisma.staffLeaveRequest.findMany.mockResolvedValue([
      {
        id: 'l1',
        staffId: 's1',
        status: 'APPROVED',
        leaveType: 'SICK',
        days: 1,
        staff: staff('s1'),
        createdAt: new Date(),
      },
      {
        id: 'l2',
        staffId: 's3',
        status: 'PENDING',
        leaveType: 'CASUAL',
        days: 1,
        staff: staff('s3'),
        createdAt: new Date(),
      },
    ]);
    const service = makeService(prisma, ['hr']);

    const result = await service.getStaffAbsence(
      withPermissions('staff:read', 'hr:leave:approve'),
      '2026-09-30',
    );

    expect(result.metrics.absentToday).toBe(1);
    expect(result.metrics.pendingLeaveToday).toBe(1);
    expect(prisma.timetableSubstitution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
      }),
    );
  });

  it('queries the Nepal school day, not the server-local day', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, ['hr']);

    await service.getStaffAbsence(
      withPermissions('staff:read', 'hr:leave:approve'),
      '2026-09-30',
    );

    // Nepal is UTC+05:45: the 2026-09-30 school day starts 2026-09-29T18:15Z.
    expect(prisma.staffAttendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attendanceDate: {
            gte: new Date('2026-09-29T18:15:00.000Z'),
            lt: new Date('2026-09-30T18:15:00.000Z'),
          },
        }),
      }),
    );
  });

  it('never invents due-today or overdue task states', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, []);

    const tasks = await service.getTasks(
      withPermissions('advanced:approvals:read'),
      'my',
    );

    expect(tasks.metrics).toEqual({
      open: 0,
      highPriority: 0,
      completed: null,
    });
    expect(tasks.metrics).not.toHaveProperty('dueToday');
    expect(tasks.metrics).not.toHaveProperty('overdue');
    // approvals list is withheld without the leave-approval permission
    expect(prisma.staffLeaveRequest.findMany).not.toHaveBeenCalled();
  });
});
