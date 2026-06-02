import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
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
  it('replays the same clientSubmissionId idempotently without submitting attendance again', async () => {
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
    const submitSpy = jest.spyOn(service, 'submitAttendance');

    const replay = await service.syncAttendance(
      {
        clientSubmissionId: 'client-sync-1',
        academicYearId: 'year-2081',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: '2026-05-10',
        deviceTimestamp: new Date('2026-05-10T08:00:00.000Z').toISOString(),
        deviceId: 'teacher-phone-1',
        exceptions: [],
      },
      actor,
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
    expect(submitSpy).not.toHaveBeenCalled();
    expect(prisma.__state.syncSubmissions).toHaveLength(1);
  });

  it('persists rejected offline submissions and replays them without resubmitting', async () => {
    const prisma = makeRejectedSyncPrisma();
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
      userId: 'teacher-user',
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    });
    const submitSpy = jest
      .spyOn(service, 'submitAttendance')
      .mockRejectedValueOnce(
        new ForbiddenException(
          'Attendance for this date is locked. Please request a correction.',
        ),
      );

    const dto = {
      clientSubmissionId: 'client-sync-rejected',
      academicYearId: 'year-2081',
      classId: 'class-1',
      sectionId: 'section-1',
      attendanceDate: '2026-05-10',
      deviceTimestamp: new Date('2026-05-10T08:00:00.000Z').toISOString(),
      deviceId: 'teacher-phone-1',
      sessionFingerprint: 'offline-session-v1',
      exceptions: [],
    };

    await expect(service.syncAttendance(dto, actor)).rejects.toThrow(
      ForbiddenException,
    );

    expect(prisma.attendanceSyncSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-attendance-sync',
        clientSubmissionId: 'client-sync-rejected',
        syncStatus: AttendanceSyncStatus.REJECTED,
        rejectionReason: AttendanceSyncRejectionReason.LOCKED_SESSION,
        payload: expect.objectContaining({
          error:
            'Attendance for this date is locked. Please request a correction.',
          trustMetadata: expect.objectContaining({
            firstSeen: true,
            flagged: false,
          }),
        }),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reject',
        resource: 'attendance_sync_submission',
        tenantId: 'tenant-attendance-sync',
        userId: 'teacher-user',
        after: expect.objectContaining({
          clientSubmissionId: 'client-sync-rejected',
          rejectionReason: AttendanceSyncRejectionReason.LOCKED_SESSION,
        }),
      }),
    );

    submitSpy.mockClear();
    const replay = await service.syncAttendance(dto, actor);

    expect(replay).toEqual(
      expect.objectContaining({
        clientSubmissionId: 'client-sync-rejected',
        syncStatus: AttendanceSyncStatus.REJECTED,
        rejectionReason: AttendanceSyncRejectionReason.LOCKED_SESSION,
        replayed: true,
        syncAttemptCount: 2,
      }),
    );
    expect(submitSpy).not.toHaveBeenCalled();
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
  const state = {
    syncSubmissions: [
      {
        id: 'sync-1',
        tenantId: 'tenant-attendance-sync',
        clientSubmissionId: 'client-sync-1',
        attendanceSessionId: 'session-1',
        conflictId: null,
        academicYearId: 'year-2081',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: new Date('2026-05-10T00:00:00.000Z'),
        deviceId: 'teacher-phone-1',
        deviceLabel: null,
        deviceTimestamp: new Date('2026-05-10T08:00:00.000Z'),
        sessionFingerprint: null,
        syncStatus: AttendanceSyncStatus.ACCEPTED,
        syncAttemptCount: 1,
        serverReceivedAt: new Date('2026-05-10T08:01:00.000Z'),
        createdAt: new Date('2026-05-10T08:01:00.000Z'),
        rejectionReason: null,
        submittedById: 'teacher-user',
        payload: {},
      },
    ],
  };
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
  };
}

function makeRejectedSyncPrisma() {
  const state: {
    syncSubmissions: Array<{
      id: string;
      tenantId: string;
      clientSubmissionId: string;
      attendanceSessionId: string | null;
      conflictId: string | null;
      academicYearId: string;
      classId: string;
      sectionId: string | null;
      attendanceDate: Date;
      deviceId: string | null;
      deviceLabel: string | null;
      deviceTimestamp: Date | null;
      sessionFingerprint: string | null;
      syncStatus: AttendanceSyncStatus;
      syncAttemptCount: number;
      serverReceivedAt: Date;
      createdAt: Date;
      rejectionReason: AttendanceSyncRejectionReason | null;
      submittedById: string;
      payload: unknown;
    }>;
  } = {
    syncSubmissions: [],
  };

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
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => {
        const created = {
          id: `sync-${state.syncSubmissions.length + 1}`,
          attendanceSessionId: null,
          conflictId: null,
          createdAt: new Date('2026-05-10T08:01:00.000Z'),
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
