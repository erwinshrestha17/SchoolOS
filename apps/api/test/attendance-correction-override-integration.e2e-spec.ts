import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceConflictDecision,
  AttendanceConflictStatus,
  AttendanceStatus,
  AttendanceSyncStatus,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import {
  AttendanceOverrideSource,
  OverrideAttendanceSessionDto,
} from '../src/attendance/dto/override-attendance-session.dto';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { createAuthContextMock } from './test-helpers';

describe('Attendance Correction + Locked Session Override Integration (E2E)', () => {
  it('blocks duplicate pending correction requests for the same student and date', async () => {
    const prisma = makeCorrectionPrisma();
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      { record: jest.fn() } as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      { getSetting: jest.fn().mockResolvedValue(true) } as unknown as SettingsService,
    );
    jest
      .spyOn(
        service as unknown as {
          getAttendanceLockAt: jest.Mock;
        },
        'getAttendanceLockAt',
      )
      .mockResolvedValue(new Date('2099-01-01T00:00:00.000Z'));

    const teacher = createAuthContextMock({
      tenantId: 'tenant-attendance-correction',
      userId: 'teacher-user',
      roles: ['teacher'],
      permissions: ['attendance:mark'],
    });

    await expect(
      service.createCorrectionRequest(
        {
          studentId: 'student-1',
          attendanceDate: '2026-05-10',
          requestedStatus: AttendanceStatus.PRESENT,
          reason: 'Marked late by mistake',
        },
        teacher,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('overrides a locked session, records conflict history, updates sync conflict, and audits the change', async () => {
    const prisma = makeOverridePrisma();
    const auditService = { record: jest.fn() };
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      auditService as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      { getSetting: jest.fn().mockResolvedValue(true) } as unknown as SettingsService,
    );
    const admin = createAuthContextMock({
      tenantId: 'tenant-attendance-correction',
      userId: 'admin-user',
      roles: ['admin'],
      permissions: ['attendance:review_conflicts'],
    });
    const dto: OverrideAttendanceSessionDto = {
      source: AttendanceOverrideSource.SYNC_CONFLICT_RESOLUTION,
      reason: 'Approved correction after parent note',
      exceptions: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
          remark: 'Corrected by admin',
        },
      ],
    };

    const result = await service.overrideLockedSession('session-1', dto, admin);

    expect(result).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        conflictStatus: AttendanceConflictStatus.REVIEWED,
        affectedSyncSubmissionCount: 1,
        totals: expect.objectContaining({ totalStudents: 2, present: 2 }),
      }),
    );
    expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
      where: {
        attendanceSessionId_studentId: {
          attendanceSessionId: 'session-1',
          studentId: 'student-1',
        },
      },
      data: {
        status: AttendanceStatus.PRESENT,
        remark: 'Corrected by admin',
        lateAt: null,
      },
    });
    expect(prisma.attendanceConflict.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-attendance-correction',
          attendanceSessionId: 'session-1',
          decision: AttendanceConflictDecision.REVIEWED_AND_OVERRIDDEN,
          status: AttendanceConflictStatus.REVIEWED,
          reviewedById: 'admin-user',
        }),
      }),
    );
    expect(prisma.attendanceSyncSubmission.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-attendance-correction',
        attendanceSessionId: 'session-1',
        syncStatus: AttendanceSyncStatus.CONFLICTED,
      },
      data: {
        syncStatus: AttendanceSyncStatus.ACCEPTED,
        rejectionReason: null,
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'override',
        resource: 'attendance_session',
        tenantId: 'tenant-attendance-correction',
        userId: 'admin-user',
        resourceId: 'session-1',
      }),
    );
  });
});

function makeCorrectionPrisma() {
  return {
    staff: {
      findUnique: jest.fn(async () => ({ id: 'staff-teacher' })),
    },
    attendanceCorrectionRequest: {
      findFirst: jest.fn(async () => ({ id: 'correction-existing' })),
    },
  };
}

function makeOverridePrisma() {
  const records = [
    {
      id: 'record-1',
      tenantId: 'tenant-attendance-correction',
      attendanceSessionId: 'session-1',
      studentId: 'student-1',
      status: AttendanceStatus.LATE,
      remark: 'Late in original sync' as string | null,
      lateAt: null,
    },
    {
      id: 'record-2',
      tenantId: 'tenant-attendance-correction',
      attendanceSessionId: 'session-1',
      studentId: 'student-2',
      status: AttendanceStatus.PRESENT,
      remark: null as string | null,
      lateAt: null,
    },
  ];
  const session = {
    id: 'session-1',
    tenantId: 'tenant-attendance-correction',
    attendanceDate: new Date('2026-05-10T00:00:00.000Z'),
    classId: 'class-1',
    sectionId: 'section-1',
    lockAt: new Date('2026-05-10T23:59:59.000Z'),
    conflictStatus: AttendanceConflictStatus.FLAGGED,
    records,
    class: { id: 'class-1', name: 'Class 1' },
    section: { id: 'section-1', name: 'A' },
  };
  const prisma: any = {
    $transaction: jest.fn((callback) => callback(prisma)),
    attendanceSession: {
      findFirst: jest.fn(async () => session),
      update: jest.fn(async ({ data }) => {
        Object.assign(session, data);
        return { ...session, records };
      }),
    },
    attendanceRecord: {
      update: jest.fn(async ({ where, data }) => {
        const record = records.find(
          (item) =>
            item.studentId === where.attendanceSessionId_studentId.studentId,
        );
        if (!record) {
          throw new Error('Attendance record not found');
        }
        Object.assign(record, data);
        return record;
      }),
    },
    attendanceConflict: {
      create: jest.fn(async () => ({ id: 'conflict-override' })),
    },
    attendanceSyncSubmission: {
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };

  return prisma;
}
