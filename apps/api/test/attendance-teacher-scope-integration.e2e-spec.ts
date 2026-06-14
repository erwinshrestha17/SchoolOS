import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceConflictStatus,
  AttendanceStatus,
  EnrollmentStatus,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { createAuthContextMock } from './test-helpers';

describe('Attendance teacher scope integration', () => {
  it('submits only assigned active roster records and blocks unassigned teacher accounts', async () => {
    const prisma = makePrisma();
    const auditService = { record: jest.fn() };
    const eventEmitter = { emit: jest.fn() };
    const service = new AttendanceService(
      prisma as unknown as PrismaService,
      {
        recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 0 }),
      } as unknown as CommunicationsService,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
      {
        getSetting: jest.fn().mockResolvedValue(24),
      } as unknown as SettingsService,
    );
    const teacher = createAuthContextMock({
      tenantId: 'tenant-attendance-scope',
      userId: 'teacher-user',
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    });
    const unassignedTeacher = createAuthContextMock({
      tenantId: 'tenant-attendance-scope',
      userId: 'unassigned-teacher-user',
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    });

    const result = await service.submitAttendance(
      {
        academicYearId: 'year-2081',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: '2026-05-10',
        exceptions: [{ studentId: 'student-1', status: AttendanceStatus.LATE }],
      },
      teacher,
    );

    expect(result.conflictStatus).toBe(AttendanceConflictStatus.NONE);
    expect(result.totals).toEqual(
      expect.objectContaining({ totalStudents: 2, late: 1, present: 1 }),
    );
    expect(prisma.state.records.map((record: any) => record.studentId)).toEqual(
      ['student-1', 'student-2'],
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'attendance.student.late',
      expect.objectContaining({
        tenantId: 'tenant-attendance-scope',
        studentId: 'student-1',
        status: AttendanceStatus.LATE,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'submit',
        resource: 'attendance_session',
        tenantId: 'tenant-attendance-scope',
      }),
    );

    await expect(
      service.submitAttendance(
        {
          academicYearId: 'year-2081',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-05-11',
          exceptions: [],
        },
        unassignedTeacher,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

function makePrisma() {
  const state = { sessions: [] as any[], records: [] as any[] };
  const tenantId = 'tenant-attendance-scope';
  const students = [
    makeStudent('student-1', true),
    makeStudent('student-2', true),
    makeStudent('student-archived', false),
  ];
  const prisma: any = {
    state,
    $transaction: jest.fn((callback) => callback(prisma)),
    tenantSetting: {
      findUnique: jest.fn(async () => null),
    },
    academicYear: {
      findFirst: jest.fn(async ({ where }) =>
        where.id === 'year-2081' && where.tenantId === tenantId
          ? { id: 'year-2081', tenantId }
          : null,
      ),
    },
    class: {
      findFirst: jest.fn(async ({ where }) =>
        where.id === 'class-1' && where.tenantId === tenantId
          ? { id: 'class-1', tenantId, name: 'Class 1' }
          : null,
      ),
    },
    staff: {
      findUnique: jest.fn(async ({ where }) =>
        where.userId === 'teacher-user' ? { id: 'staff-1' } : null,
      ),
      findFirst: jest.fn(async ({ where }) =>
        where.userId === 'teacher-user' && where.tenantId === tenantId
          ? { id: 'staff-1' }
          : null,
      ),
    },
    subjectTeacherAssignment: {
      findMany: jest.fn(async ({ where }) =>
        where.staffId === 'staff-1' ? [{ sectionId: 'section-1' }] : [],
      ),
    },
    section: {
      findFirst: jest.fn(async ({ where }) =>
        where.id === 'section-1' && where.tenantId === tenantId
          ? { id: 'section-1', tenantId, classId: 'class-1', name: 'A' }
          : null,
      ),
      findMany: jest.fn(async () => []),
    },
    schoolCalendarDay: {
      findFirst: jest.fn(async () => ({
        id: 'calendar-working-day',
        tenantId,
        calendarDate: new Date('2026-05-10T00:00:00.000Z'),
        isWorkingDay: true,
        label: null,
        holidayType: null,
      })),
      findMany: jest.fn(async () => []),
    },
    student: {
      findMany: jest.fn(async () =>
        students.filter((student) =>
          student.enrollments.some(
            (enrollment: any) => enrollment.status === EnrollmentStatus.ACTIVE,
          ),
        ),
      ),
    },
    attendanceSession: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => {
        const session = {
          id: 'session-1',
          ...data,
          class: { name: 'Class 1' },
          section: { name: 'A' },
        };
        state.sessions.push(session);
        return session;
      }),
      findUniqueOrThrow: jest.fn(async () => ({
        ...state.sessions[0],
        class: { name: 'Class 1' },
        section: { name: 'A' },
        records: state.records,
      })),
    },
    attendanceRecord: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async ({ data }) => {
        state.records.push(...data);
        return { count: data.length };
      }),
      findMany: jest.fn(async () => []),
    },
    attendanceConflict: {
      create: jest.fn(async () => ({ id: 'conflict-1' })),
    },
    notificationDelivery: {
      findFirst: jest.fn(async () => null),
    },
  };
  return prisma;

  function makeStudent(id: string, active: boolean) {
    return {
      id,
      tenantId,
      classId: 'class-1',
      sectionId: 'section-1',
      enrollments: [
        {
          tenantId,
          academicYearId: 'year-2081',
          classId: 'class-1',
          sectionId: 'section-1',
          status: active ? EnrollmentStatus.ACTIVE : EnrollmentStatus.EXITED,
        },
      ],
    };
  }
}
