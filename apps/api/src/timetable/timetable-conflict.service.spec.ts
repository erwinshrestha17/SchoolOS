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
    service = new TimetableConflictService();
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
});
