import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { createAuthContextMock } from './test-helpers';

describe('Attendance report integration depth', () => {
  it('builds monthly register rows and CSV from backend records', async () => {
    const service = new AttendanceService(
      makePrisma() as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      { record: jest.fn() } as unknown as AuditService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      {
        getSetting: jest.fn().mockResolvedValue(true),
      } as unknown as SettingsService,
    );
    const actor = createAuthContextMock({
      tenantId: 'tenant-attendance-depth',
      roles: ['admin'],
      permissions: ['attendance:read', 'attendance:read_all'],
    });
    const query = {
      academicYearId: 'year-2081',
      classId: 'class-1',
      sectionId: 'section-1',
      month: 5,
      year: 2026,
    };

    const register = await service.getMonthlyRegister(query, actor);

    expect(register.matrix).toHaveLength(2);
    expect(register.matrix[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        totals: expect.objectContaining({ PRESENT: 1, LATE: 1 }),
      }),
    );
    expect(register.matrix[0].attendance).toEqual(
      expect.arrayContaining([{ day: 3, status: 'HOLIDAY' }]),
    );

    const csv = await service.exportMonthlyRegister(query, actor);

    expect(csv).toContain('"Roll No","Student Name"');
    expect(csv).toContain('"1","Aarav Shrestha"');
    expect(csv).toContain('"2","Sita Thapa"');
    expect(csv).toContain('PRESENT');
    expect(csv).toContain('LATE');
  });
});

function makePrisma() {
  const tenantId = 'tenant-attendance-depth';
  const academicYearId = 'year-2081';
  const classId = 'class-1';
  const sectionId = 'section-1';
  const students = [
    makeStudent('student-1', 'Aarav', 'Shrestha', '1'),
    makeStudent('student-2', 'Sita', 'Thapa', '2'),
  ];
  const sessions = [
    makeSession(new Date(2026, 4, 1), [
      ['student-1', AttendanceStatus.PRESENT],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
    makeSession(new Date(2026, 4, 2), [
      ['student-1', AttendanceStatus.LATE],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
  ];
  const calendarDays = [
    {
      id: 'holiday-1',
      tenantId,
      calendarDate: new Date(2026, 4, 3),
      isWorkingDay: false,
    },
  ];

  return {
    student: { findMany: jest.fn(async () => students) },
    attendanceSession: { findMany: jest.fn(async () => sessions) },
    schoolCalendarDay: { findMany: jest.fn(async () => calendarDays) },
  };

  function makeStudent(
    id: string,
    firstNameEn: string,
    lastNameEn: string,
    rollNumber: string,
  ) {
    return {
      id,
      tenantId,
      firstNameEn,
      lastNameEn,
      rollNumber,
      classId,
      sectionId,
      enrollments: [
        {
          tenantId,
          academicYearId,
          classId,
          sectionId,
          status: EnrollmentStatus.ACTIVE,
        },
      ],
    };
  }

  function makeSession(
    attendanceDate: Date,
    rows: [string, AttendanceStatus][],
  ) {
    return {
      id: `session-${attendanceDate.getDate()}`,
      tenantId,
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
      records: rows.map(([studentId, status], index) => ({
        id: `record-${attendanceDate.getDate()}-${index}`,
        tenantId,
        attendanceSessionId: `session-${attendanceDate.getDate()}`,
        studentId,
        status,
        remark: null,
        lateAt: null,
      })),
    };
  }
}
