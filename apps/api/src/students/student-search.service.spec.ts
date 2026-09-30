import { AuthMethod } from '@prisma/client';
import { StudentSearchService } from './student-search.service';

const ENABLED = { module: 'students', state: 'ENABLED' } as const;

const baseActor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'user@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
};

const row = {
  id: 'student-1',
  classId: 'class-1',
  sectionId: 'section-1',
  studentSystemId: 'SCH-1',
  firstNameEn: 'Asmita',
  lastNameEn: 'Gurung',
  admissionNumber: 'ADM-1',
  rollNumber: 7,
  lifecycleStatus: 'ACTIVE',
  className: 'Grade 8',
  sectionName: 'A',
  guardianName: 'Narayan Gurung',
  guardianPhone: '9812100017',
};

interface SqlFragment {
  strings?: readonly string[];
  values?: unknown[];
  joined?: unknown[];
}

/** Flattens the mocked Prisma.sql tree into its text and bound values. */
function flatten(fragment: unknown): { text: string; values: unknown[] } {
  const f = (fragment ?? {}) as SqlFragment;
  if (Array.isArray(f.joined)) return { text: '?', values: [...f.joined] };
  const strings = f.strings;
  if (!Array.isArray(strings)) return { text: '?', values: [fragment] };
  const parts: string[] = [strings[0] ?? ''];
  const values: unknown[] = [];
  (f.values ?? []).forEach((value, index) => {
    const inner = flatten(value);
    parts.push(inner.text, strings[index + 1] ?? '');
    values.push(...inner.values);
  });
  return { text: parts.join(''), values };
}

function buildService(options: {
  rows?: unknown[];
  sections?: string[];
  parentChildren?: string[] | null;
}) {
  const queryRaw = jest.fn().mockResolvedValue(options.rows ?? [row]);
  const prisma = {
    $queryRaw: queryRaw,
    guardian: {
      findFirst: jest.fn().mockResolvedValue(
        options.parentChildren === undefined || options.parentChildren === null
          ? null
          : {
              id: 'guardian-1',
              studentLinks: options.parentChildren.map((studentId) => ({
                studentId,
              })),
            },
      ),
    },
  };
  const teacherScope = {
    resolveReadableScope: jest.fn().mockResolvedValue({
      allSectionIds: new Set(options.sections ?? []),
    }),
  };
  const service = new StudentSearchService(
    prisma as never,
    teacherScope as never,
  );
  return { service, queryRaw, teacherScope };
}

describe('StudentSearchService (authorization-aware global search)', () => {
  it('limits a teacher to live assigned sections inside the SQL', async () => {
    const { service, queryRaw } = buildService({ sections: ['section-1'] });

    const results = await service.searchStudents(
      'asm',
      { ...baseActor, roles: ['teacher'], permissions: ['students:read'] },
      ENABLED,
    );

    const { text, values } = flatten(queryRaw.mock.calls[0][0]);
    expect(text).toContain('s."sectionId" IN (');
    expect(values).toContain('section-1');
    expect(results).toHaveLength(1);
    // Verified teacher assignment releases guardian contact (RBAC §14).
    expect(results[0]).toMatchObject({
      guardianName: 'Narayan Gurung',
      guardianPhone: '9812100017',
    });
  });

  it('returns nothing without querying when a teacher has no live assignment', async () => {
    const { service, queryRaw } = buildService({ sections: [] });

    await expect(
      service.searchStudents(
        'asm',
        { ...baseActor, roles: ['teacher'], permissions: ['students:read'] },
        ENABLED,
      ),
    ).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('omits guardian contact for a reader without a guardian section', async () => {
    const { service, queryRaw } = buildService({});

    const [result] = await service.searchStudents(
      'asm',
      {
        ...baseActor,
        roles: ['accountant'],
        permissions: ['students:read', 'fees:manage'],
      },
      ENABLED,
    );

    const { text } = flatten(queryRaw.mock.calls[0][0]);
    expect(text).not.toContain('s."sectionId" IN (');
    expect(result).toMatchObject({
      id: 'student-1',
      fullNameEn: 'Asmita Gurung',
    });
    expect(result).not.toHaveProperty('guardianName');
    expect(result).not.toHaveProperty('guardianPhone');
  });

  it('only matches and discloses ACTIVE, VERIFIED, in-period guardian links', async () => {
    const { service, queryRaw } = buildService({});

    await service.searchStudents(
      '9812',
      {
        ...baseActor,
        roles: ['admin'],
        permissions: ['students:read', 'guardians:read'],
      },
      ENABLED,
    );

    const { text } = flatten(queryRaw.mock.calls[0][0]);
    expect(text.match(/sg\."status" = 'ACTIVE'/g)).toHaveLength(2);
    expect(text.match(/sg\."verificationStatus" = 'VERIFIED'/g)).toHaveLength(
      2,
    );
    expect(text.match(/sg\."effectiveUntil" IS NULL OR/g)).toHaveLength(2);
  });

  it('fails closed on guardian contact without entitlement evidence', async () => {
    const { service } = buildService({});

    const [result] = await service.searchStudents('asm', {
      ...baseActor,
      roles: ['admin'],
      permissions: ['students:read', 'guardians:read'],
    });

    expect(result).not.toHaveProperty('guardianPhone');
  });
});
