import { TeacherAvailabilityType } from '@prisma/client';
import { TimetableConflictService } from './timetable-conflict.service';

const baseSlot = {
  id: 'slot-candidate',
  tenantId: 'tenant-a',
  academicYearId: 'year-1',
  versionId: 'version-1',
  classId: 'class-1',
  sectionId: 'section-a',
  subjectId: 'subject-math',
  staffId: 'teacher-1',
  roomId: 'room-1',
  dayOfWeek: 1,
  startsAt: '09:00',
  endsAt: '10:00',
};

describe('TimetableConflictService', () => {
  let service: TimetableConflictService;

  beforeEach(() => {
    service = new TimetableConflictService({} as never);
  });

  it('detects teacher double booking for overlapping periods', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-existing',
          classId: 'class-2',
          sectionId: 'section-b',
          roomId: 'room-2',
          startsAt: '09:30',
          endsAt: '10:30',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TEACHER_DOUBLE_BOOKED',
          severity: 'BLOCKING',
          teacherId: 'teacher-1',
        }),
      ]),
    );
  });

  it('detects room double booking for overlapping periods', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-existing',
          staffId: 'teacher-2',
          classId: 'class-2',
          sectionId: 'section-b',
          roomId: 'room-1',
          startsAt: '08:45',
          endsAt: '09:15',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ROOM_DOUBLE_BOOKED',
          severity: 'BLOCKING',
          roomId: 'room-1',
        }),
      ]),
    );
  });

  it('detects class-section overlap even when teacher and room differ', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-existing',
          subjectId: 'subject-english',
          staffId: 'teacher-2',
          roomId: 'room-2',
          startsAt: '09:15',
          endsAt: '09:45',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CLASS_SECTION_OVERLAP',
          severity: 'BLOCKING',
          classId: 'class-1',
          sectionId: 'section-a',
        }),
      ]),
    );
  });

  it('treats class-wide slots as conflicts with section-specific slots', () => {
    const result = service.validateCandidate({
      candidate: {
        ...baseSlot,
        sectionId: 'section-a',
      },
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-class-wide',
          sectionId: null,
          subjectId: 'subject-english',
          staffId: 'teacher-2',
          roomId: 'room-2',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CLASS_SECTION_OVERLAP',
          severity: 'BLOCKING',
          classId: 'class-1',
          sectionId: 'section-a',
        }),
      ]),
    );
  });

  it('detects teacher unavailable periods as blocking conflicts', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [],
      teacherAvailability: [
        {
          id: 'availability-1',
          staffId: 'teacher-1',
          academicYearId: 'year-1',
          dayOfWeek: 1,
          startsAt: '08:30',
          endsAt: '09:30',
          type: TeacherAvailabilityType.UNAVAILABLE,
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TEACHER_UNAVAILABLE',
          severity: 'BLOCKING',
          teacherId: 'teacher-1',
        }),
      ]),
    );
  });

  it('detects daily and weekly workload limits', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-existing-1',
          startsAt: '10:00',
          endsAt: '11:00',
        },
        {
          ...baseSlot,
          id: 'slot-existing-2',
          dayOfWeek: 2,
          startsAt: '09:00',
          endsAt: '10:00',
        },
      ],
      teacherWorkloadLimit: {
        staffId: 'teacher-1',
        maxPeriodsPerDay: 1,
        maxPeriodsPerWeek: 2,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'WORKLOAD_EXCEEDED',
          severity: 'BLOCKING',
          message: expect.stringContaining('daily workload'),
        }),
        expect.objectContaining({
          type: 'WORKLOAD_EXCEEDED',
          severity: 'BLOCKING',
          message: expect.stringContaining('weekly workload'),
        }),
      ]),
    );
  });

  it('returns subject weekly requirement warnings without blocking draft validation', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [],
      subjectWeeklyRequirement: {
        subjectId: 'subject-math',
        classId: 'class-1',
        sectionId: 'section-a',
        requiredPeriodsPerWeek: 4,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SUBJECT_REQUIREMENT_MISSING',
          severity: 'WARNING',
          subjectId: 'subject-math',
        }),
      ]),
    );
  });

  it('allows non-overlapping periods for same teacher, room, and class-section', () => {
    const result = service.validateCandidate({
      candidate: baseSlot,
      existingSlots: [
        {
          ...baseSlot,
          id: 'slot-existing',
          startsAt: '10:00',
          endsAt: '11:00',
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports Sunday teacher absences with timetable day 7', async () => {
    const attendanceService = {
      getTeacherAbsenceContext: jest.fn().mockResolvedValue({
        isAbsent: true,
        attendanceStatus: null,
        leaveType: 'SICK',
      }),
    };
    const serviceWithAttendance = new TimetableConflictService(
      {} as never,
      attendanceService as never,
    );

    const issues = await serviceWithAttendance.detectTeacherAbsenceConflict(
      'tenant-a',
      'teacher-1',
      '2026-05-10',
    );

    expect(issues).toEqual([
      expect.objectContaining({
        type: 'TEACHER_ABSENT',
        severity: 'WARNING',
        teacherId: 'teacher-1',
        dayOfWeek: 7,
        message: 'Teacher is on approved sick leave on this date.',
      }),
    ]);
  });

  describe('validateVersionSlots', () => {
    it('aggregates conflicts for all slots in a version', () => {
      const slots = [
        { ...baseSlot, id: 'slot-1', startsAt: '09:00', endsAt: '10:00' },
        { ...baseSlot, id: 'slot-2', startsAt: '09:30', endsAt: '10:30' }, // Overlap with slot-1
      ];

      const result = service.validateVersionSlots(slots);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'TEACHER_DOUBLE_BOOKED',
            severity: 'BLOCKING',
          }),
        ]),
      );
    });

    it('validates subject weekly requirements once per subject scope', () => {
      const slots = [
        { ...baseSlot, id: 'slot-1' },
        { ...baseSlot, id: 'slot-2', startsAt: '10:00', endsAt: '11:00' },
      ];
      const requirements = [
        {
          subjectId: 'subject-math',
          classId: 'class-1',
          sectionId: 'section-a',
          requiredPeriodsPerWeek: 3,
        },
      ];

      const result = service.validateVersionSlots(slots, requirements);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual(
        expect.objectContaining({
          type: 'SUBJECT_REQUIREMENT_MISSING',
          message: expect.stringContaining('(2/3)'),
        }),
      );
    });
  });
});
