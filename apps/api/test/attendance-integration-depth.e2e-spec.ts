import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { createAuthContextMock } from './test-helpers';

describe('Attendance Reliability + Reports Integration Depth (E2E)', () => {
  const tenantId = 'tenant-attendance-depth';
  const academicYearId = 'year-2081';
  const classId = 'class-1';
  const sectionId = 'section-1';

  it('generates tenant-scoped monthly register and CSV export from backend records', async () => {
    const service = new AttendanceService(
      buildPrismaMock({ tenantId, academicYearId, classId, sectionId }) as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      { record: jest.fn() } as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      { getSetting: jest.fn().mockResolvedValue(true) } as unknown as SettingsService,
    );
    const actor = createAuthContextMock({
      tenantId,
      roles: ['admin'],
      permissions: ['attendance:read', 'attendance:read_all'],
    });

    const query = { academicYearId, classId, sectionId, month: 5, year: 2026 };
    const register = await service.getMonthlyRegister(query, actor);

    expect(register.matrix).toHaveLength(2);
    expect(register.matrix[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        totals: expect.objectContaining({ PRESENT: 1, LATE: 1, HOLIDAY: 1 }),
      }),
    );
    expect(register.matrix[1]).toEqual(
      expect.objectContaining({
        studentId: 'student-2',
        totals: expect.objectContaining({ PRESENT: 1, ABSENT: 1, HOLIDAY: 1 }),
      }),
    );

    const csv = await service.exportMonthlyRegister(query, actor);
    expect(csv).toContain('student-1');
    expect(csv).toContain('student-2');
    expect(csv).toContain('PRESENT');
    expect(csv).toContain('ABSENT');
  });
});

function buildPrismaMock(input: {
  tenantId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
}) {
  const students = [
    student(input, 'student-1', 'Aarav', 'Shrestha', '1'),
    student(input, 'student-2', 'Sita', 'Thapa', '2'),
  ];
  const sessions = [
    session(input, new Date(2026, 4, 1), [
      ['student-1', AttendanceStatus.PRESENT],
      ['student-2', AttendanceStatus.ABSENT],
    ]),
    session(input, new Date(2026, 4, 2), [
      ['student-1', AttendanceStatus.LATE],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
  ];
  const calendarDays = [
    {
      id: 'holiday-1',
      tenantId: input.tenantId,
      calendarDate: new Date(2026, 4, 3),
      isWorkingDay: false,
    },
  ];

  return {
    student: { findMany: jest.fn(async () => students) },
    attendanceSession: { findMany: jest.fn(async () => sessions) },
    schoolCalendarDay: { findMany: jest.fn(async () => calendarDays) },
  };
}

function student(
  input: {
    tenantId: string;
    academicYearId: string;
    classId: string;
    sectionId: string;
  },
  id: string,
  firstNameEn: string,
  lastNameEn: string,
  rollNumber: string,
) {
  return {
    id,
    tenantId: input.tenantId,
    firstNameEn,
    lastNameEn,
    rollNumber,
    classId: input.classId,
    sectionId: input.sectionId,
    enrollments: [
      {
        tenantId: input.tenantId,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId,
        status: EnrollmentStatus.ACTIVE,
      },
    ],
  };
}

function session(
  input: { tenantId: string; academicYearId: string; classId: string; sectionId: string },
  attendanceDate: Date,
  rows: Array<[string, AttendanceStatus]>,
) {
  return {
    id: `session-${attendanceDate.getDate()}`,
    tenantId: input.tenantId,
    academicYearId: input.academicYearId,
    classId: input.classId,
    sectionId: input.sectionId,
    attendanceDate,
    records: rows.map(([studentId, status], index) => ({
      id: `record-${attendanceDate.getDate()}-${index}`,
      tenantId: input.tenantId,
      attendanceSessionId: `session-${attendanceDate.getDate()}`,
      studentId,
      status,
      remark: null,
      lateAt: null,
    })),
  };
}
