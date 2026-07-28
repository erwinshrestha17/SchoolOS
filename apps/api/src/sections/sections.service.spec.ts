import { AuthMethod, TeacherAssignmentType } from '@prisma/client';
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
  assignments?: unknown[];
}) {
  const prisma = {
    section: {
      findMany: jest.fn().mockResolvedValue(options.sections ?? []),
    },
  };
  const audit = { record: jest.fn() };
  const teacherScope = {
    resolveReadableScope: jest.fn().mockResolvedValue({
      assignments: options.assignments ?? [],
      homeroomSectionIds: new Set(),
      subjectsBySection: new Map(),
      allSectionIds: new Set(),
    }),
  };

  const service = new SectionsService(
    prisma as never,
    audit as never,
    teacherScope as never,
  );

  return { service, prisma, teacherScope };
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
      sections: [buildSection({ id: 'section-1', classTeacherId: 'staff-9' })],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections).toEqual([
      expect.objectContaining({
        id: 'section-1',
        isAssignedClassTeacher: true,
      }),
    ]);
  });

  it('flags subject-teaching sections from canonical assignments', async () => {
    const { service } = buildService({
      sections: [
        buildSection({ id: 'section-1', classId: 'class-1' }),
        buildSection({ id: 'section-2', classId: 'class-2' }),
        buildSection({ id: 'section-3', classId: 'class-3' }),
      ],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        },
        {
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          classId: 'class-2',
          sectionId: 'section-2',
          subjectId: 'subject-1',
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections.map((s) => s.isAssignedSubjectTeacher)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('returns no tenant-wide sections for a teacher without an active assignment', async () => {
    const { service, prisma } = buildService({
      sections: [],
      assignments: [],
    });

    const sections = await service.listSections(teacherActor);

    expect(prisma.section.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: teacherActor.tenantId,
        id: { in: ['__no_teacher_sections__'] },
      },
      include: expect.any(Object),
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    });
    expect(sections).toEqual([]);
  });

  it('includes a flat classId alongside the nested class object', async () => {
    // Confirmed gap: every web consumer that filters this endpoint's
    // response by `section.classId` (homework/CAS/report-card/timetable
    // class-section pickers) was silently broken because this response
    // only ever populated the nested `class` object, never the flat
    // `classId` the shared SectionSummary type also declares.
    const { service } = buildService({
      sections: [buildSection({ id: 'section-1', classId: 'class-1' })],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections[0].classId).toBe('class-1');
  });
});
