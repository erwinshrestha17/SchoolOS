import { AuthMethod } from '@prisma/client';
import { SectionsService } from './sections.service';

const teacherActor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-teacher',
  email: 'teacher@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['teacher'],
  permissions: ['sections:read'],
};

function buildService(options: {
  sections?: unknown[];
  staff?: unknown;
  subjectAssignments?: unknown[];
}) {
  const prisma = {
    section: {
      findMany: jest.fn().mockResolvedValue(options.sections ?? []),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? null),
    },
    subjectTeacherAssignment: {
      findMany: jest.fn().mockResolvedValue(options.subjectAssignments ?? []),
    },
  };
  const audit = { record: jest.fn() };

  const service = new SectionsService(prisma as never, audit as never);

  return { service, prisma };
}

function buildSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'section-1',
    name: 'A',
    capacity: 40,
    classTeacherId: null,
    classId: 'class-1',
    class: { id: 'class-1', name: 'Grade 1' },
    _count: { students: 28 },
    ...overrides,
  };
}

describe('SectionsService.listSections', () => {
  it('flags the sections where the caller is the class teacher', async () => {
    const { service } = buildService({
      sections: [
        buildSection({ id: 'section-1', classTeacherId: 'staff-9' }),
        buildSection({ id: 'section-2', classTeacherId: 'staff-other' }),
      ],
      staff: { id: 'staff-9' },
    });

    const sections = await service.listSections(teacherActor);

    expect(sections).toEqual([
      expect.objectContaining({
        id: 'section-1',
        isAssignedClassTeacher: true,
      }),
      expect.objectContaining({
        id: 'section-2',
        isAssignedClassTeacher: false,
      }),
    ]);
  });

  it('flags subject-teaching sections including class-wide assignments', async () => {
    const { service } = buildService({
      sections: [
        buildSection({ id: 'section-1', classId: 'class-1' }),
        buildSection({ id: 'section-2', classId: 'class-2' }),
        buildSection({ id: 'section-3', classId: 'class-3' }),
      ],
      staff: { id: 'staff-9' },
      subjectAssignments: [
        { classId: 'class-1', sectionId: 'section-1' },
        { classId: 'class-2', sectionId: null },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections.map((s) => s.isAssignedSubjectTeacher)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('never flags sections for callers without a staff record', async () => {
    const { service, prisma } = buildService({
      sections: [buildSection({ classTeacherId: 'staff-9' })],
      staff: null,
    });

    const sections = await service.listSections(teacherActor);

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { userId: teacherActor.userId, tenantId: teacherActor.tenantId },
      select: { id: true },
    });
    expect(sections[0].isAssignedClassTeacher).toBe(false);
  });

  it('includes a flat classId alongside the nested class object', async () => {
    // Confirmed gap: every web consumer that filters this endpoint's
    // response by `section.classId` (homework/CAS/report-card/timetable
    // class-section pickers) was silently broken because this response
    // only ever populated the nested `class` object, never the flat
    // `classId` the shared SectionSummary type also declares.
    const { service } = buildService({
      sections: [buildSection({ id: 'section-1', classId: 'class-1' })],
      staff: { id: 'staff-9' },
    });

    const sections = await service.listSections(teacherActor);

    expect(sections[0].classId).toBe('class-1');
  });
});
