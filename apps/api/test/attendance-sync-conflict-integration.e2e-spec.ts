import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceConflictDecision,
  AttendanceConflictStatus,
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { AttendanceConflictReviewDecision } from '../src/attendance/dto/review-attendance-conflict.dto';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { createAuthContextMock } from './test-helpers';

describe('Attendance Sync + Conflict Integration (E2E)', () => {
  it('accepts first offline sync submission and replays the same clientSubmissionId idempotently', async () => {
    const prisma = makeSyncPrisma();
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      { record: jest.fn() } as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      {
        getSetting: jest.fn().mockResolvedValue(true),
      } as unknown as SettingsService,
    );
    const actor = createAuthContextMock({
      tenantId: 'tenant-attendance-sync',
      userId: 'teacher-user',
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    });

    jest
      .spyOn(
        service as unknown as {
          buildSyncTrustMetadata: jest.Mock;
        },
        'buildSyncTrustMetadata',
      )
      .mockResolvedValue({ trusted: true });
    jest.spyOn(service, 'submitAttendance').mockResolvedValue({
      sessionId: 'session-1',
      conflictStatus: AttendanceConflictStatus.NONE,
    } as Awaited<ReturnType<AttendanceService['submitAttendance']>>);

    const dto = {
      clientSubmissionId: 'client-sync-1',
      academicYearId: 'year-2081',
      classId: 'class-1',
      sectionId: 'section-1',
      attendanceDate: '2026-05-10',
      deviceTimestamp: new Date('2026-05-10T08:00:00.000Z').toISOString(),
      deviceId: 'teacher-phone-1',
      exceptions: [],
    };

    const first = await service.syncAttendance(dto, actor);
    const replay = await service.syncAttendance(dto, actor);

    expect(first).toEqual(
      expect.objectContaining({
        clientSubmissionId: 'client-sync-1',
        attendanceSessionId: 'session-1',
        syncStatus: AttendanceSyncStatus.ACCEPTED,
        replayed: false,
      }),
    );
    expect(replay).toEqual(
      expect.objectContaining({
        clientSubmissionId: 'client-sync-1',
        attendanceSessionId: 'session-1',
        syncStatus: AttendanceSyncStatus.ACCEPTED,
        replayed: true,
        syncAttemptCount: 2,
      }),
    );
    expect(service.submitAttendance).toHaveBeenCalledTimes(1);
    expect(prisma.__state.syncSubmissions).toHaveLength(1);
  });

  it('reviews a flagged conflict, updates related sync submissions, and writes audit history', async () => {
    const prisma = makeConflictPrisma();
    const auditService = { record: jest.fn() };
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      auditService as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      {
        getSetting: jest.fn().mockResolvedValue(true),
      } as unknown as SettingsService,
    );
    const actor = createAuthContextMock({
      tenantId: 'tenant-attendance-sync',
      userId: 'admin-user',
      roles: ['admin'],
      permissions: ['attendance:review_conflicts'],
    });

    const result = await service.reviewConflict(
      'conflict-1',
      {
        decision: AttendanceConflictReviewDecision.REJECTED_RESUBMISSION,
        resolutionNote: 'Rejected stale offline draft',
      },
      actor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'conflict-1',
        status: AttendanceConflictStatus.REVIEWED,
        decision: AttendanceConflictDecision.REJECTED_RESUBMISSION,
        affectedSyncSubmissionCount: 1,
      }),
    );
    expect(prisma.attendanceSyncSubmission.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-attendance-sync',
        conflictId: 'conflict-1',
      },
      data: {
        syncStatus: AttendanceSyncStatus.REJECTED,
        rejectionReason: AttendanceSyncRejectionReason.ROSTER_MISMATCH,
      },
    });
    expect(prisma.attendanceSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { conflictStatus: AttendanceConflictStatus.REVIEWED },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'review',
        resource: 'attendance_conflict',
        tenantId: 'tenant-attendance-sync',
        userId: 'admin-user',
        resourceId: 'conflict-1',
      }),
    );
  });
});

function makeSyncPrisma() {
  const state = { syncSubmissions: [] as any[] };
  return {
    __state: state,
    attendanceSyncSubmission: {
      findUnique: jest.fn(async ({ where }) => {
        const key = where.tenantId_clientSubmissionId;
        return (
          state.syncSubmissions.find(
            (item) =>
              item.tenantId === key.tenantId &&
              item.clientSubmissionId === key.clientSubmissionId,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }) => {
        const created = {
          id: `sync-${state.syncSubmissions.length + 1}`,
          syncAttemptCount: 1,
          syncStatus: AttendanceSyncStatus.ACCEPTED,
          ...data,
        };
        state.syncSubmissions.push(created);
        return created;
      }),
      update: jest.fn(async ({ where }) => {
        const found = state.syncSubmissions.find(
          (item) => item.id === where.id,
        );
        if (!found) {
          throw new Error('Sync submission not found');
        }
        found.syncAttemptCount += 1;
        return found;
      }),
    },
    attendanceConflict: {
      findFirst: jest.fn(async () => null),
    },
  };
}

function makeConflictPrisma() {
  const conflict = {
    id: 'conflict-1',
    tenantId: 'tenant-attendance-sync',
    attendanceSessionId: 'session-1',
    status: AttendanceConflictStatus.FLAGGED,
    decision: null,
    resolutionNote: null,
    reviewedById: null,
    reviewedAt: null,
  };
  return {
    attendanceConflict: {
      findFirst: jest.fn(async () => conflict),
      update: jest.fn(async ({ data }) => Object.assign(conflict, data)),
    },
    attendanceSyncSubmission: {
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    attendanceSession: {
      update: jest.fn(async () => ({ id: 'session-1' })),
    },
  };
}
