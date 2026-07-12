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
        totals: expect.objectContaining({
          PRESENT: 2,
          LATE: 1,
          HOLIDAY: 6,
          workingDays: 25,
          markedDays: 3,
          percentage: 100,
        }),
      }),
    );
    expect(register.matrix[0].attendance).toEqual(
      expect.arrayContaining([
        { day: 2, status: 'HOLIDAY' },
        { day: 4, status: 'HOLIDAY' },
        { day: 5, status: 'PRESENT' },
      ]),
    );
    expect(register.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: 4,
          isWorkingDay: false,
          holidayType: 'CLOSURE',
        }),
        expect.objectContaining({
          day: 5,
          isWorkingDay: true,
          holidayType: 'EXAM_DAY',
        }),
      ]),
    );
    expect(register.summary).toEqual(
      expect.objectContaining({
        workingDays: 25,
        holidayDays: 6,
        submittedDays: 3,
        draftDays: 0,
        notMarkedDays: 22,
        attendancePercentage: 100,
      }),
    );

    const csv = await service.exportMonthlyRegister(query, 'csv', actor);

    expect(csv).toContain('"Roll No","Student Name"');
    expect(csv).toContain('"1","Aarav Shrestha"');
    expect(csv).toContain('"2","Sita Thapa"');
    expect(csv).toContain('PRESENT');
    expect(csv).toContain('LATE');
    expect(csv).toContain('"WORKING DAYS"');
    expect(csv).toContain('"PERCENTAGE"');
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
    makeSession(new Date(Date.UTC(2026, 4, 1)), [
      ['student-1', AttendanceStatus.PRESENT],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
    makeSession(new Date(Date.UTC(2026, 4, 3)), [
      ['student-1', AttendanceStatus.LATE],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
    makeSession(new Date(Date.UTC(2026, 4, 5)), [
      ['student-1', AttendanceStatus.PRESENT],
      ['student-2', AttendanceStatus.PRESENT],
    ]),
  ];
  const calendarDays = [
    {
      id: 'closure-1',
      tenantId,
      calendarDate: new Date(Date.UTC(2026, 4, 4)),
      isWorkingDay: false,
      label: 'Unexpected closure',
      holidayType: 'CLOSURE',
    },
    {
      id: 'exam-1',
      tenantId,
      calendarDate: new Date(Date.UTC(2026, 4, 5)),
      isWorkingDay: true,
      label: 'Terminal exam',
      holidayType: 'EXAM_DAY',
    },
  ];

  return {
    student: { findMany: jest.fn(async () => students) },
    class: {
      findFirst: jest.fn(async () => ({ id: classId, name: 'Grade 1' })),
    },
    section: {
      findFirst: jest.fn(async () => ({ id: sectionId, name: 'A' })),
    },
    attendanceSession: { findMany: jest.fn(async () => sessions) },
    schoolCalendarDay: { findMany: jest.fn(async () => calendarDays) },
    reportExport: { create: jest.fn(async () => ({ id: 'export-1' })) },
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
      submittedAt: new Date(attendanceDate.getTime() + 8 * 60 * 60 * 1000),
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
