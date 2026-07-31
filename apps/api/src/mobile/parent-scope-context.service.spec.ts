import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthMethod, GuardianCapability } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ClsService } from 'nestjs-cls';
import { RequestCacheService } from '../common/cache/request-cache.service';
import { ParentScopeContextService } from './parent-scope-context.service';

/**
 * These tests pin the security behaviour of the request-scoped parent scope.
 *
 * The optimization moved the guardian-capability predicate from the SQL `where`
 * clause into memory so one query can answer every capability check in a
 * request. That is only safe if the in-memory predicate is exactly as strict as
 * the SQL one was, so each denial path below is asserted explicitly rather than
 * inferred from "the query returned nothing".
 */
describe('ParentScopeContextService', () => {
  const parentActor: AuthContext = {
    userId: 'parent-1',
    tenantId: 'tenant-1',
    tenantSlug: 'green-valley',
    email: 'parent@school.test',
    authMethod: AuthMethod.PASSWORD,
    mustChangePassword: false,
    roles: ['parent'],
    permissions: [],
  } as AuthContext;

  let prisma: {
    guardian: { findFirst: jest.Mock };
    student: { findFirst: jest.Mock };
    studentGuardian: { findMany: jest.Mock };
    academicYear: { findFirst: jest.Mock };
  };
  let service: ParentScopeContextService;

  /** Real cache over a live CLS store, so memoization is actually exercised. */
  function makeActiveCache() {
    const store = new Map<string, unknown>();
    const cls = {
      isActive: () => true,
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => store.set(key, value),
    } as unknown as ClsService;
    return new RequestCacheService(cls);
  }

  function linkRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'link-1',
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relation: 'Father',
      capabilities: [
        GuardianCapability.ACADEMICS_VIEW,
        GuardianCapability.ATTENDANCE_VIEW,
        GuardianCapability.FEES_VIEW,
      ],
      effectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
      effectiveUntil: null,
      emergencyContactPriority: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      guardian: { findFirst: jest.fn() },
      student: { findFirst: jest.fn() },
      studentGuardian: { findMany: jest.fn() },
      academicYear: { findFirst: jest.fn() },
    };
    service = new ParentScopeContextService(prisma as never, makeActiveCache());
  });

  describe('guardian capability resolution', () => {
    it('grants a capability the relationship carries', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow()],
      });

      await expect(
        service.guardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.FEES_VIEW,
        ),
      ).resolves.toEqual(expect.objectContaining({ studentId: 'student-1' }));
    });

    it('denies a capability the relationship does not carry', async () => {
      // The relationship is fully active and approved — only the capability is
      // absent. Previously the database filtered this row out; now the
      // in-memory check must reject it just as firmly.
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [
          linkRow({ capabilities: [GuardianCapability.ACADEMICS_VIEW] }),
        ],
      });

      await expect(
        service.guardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.FEES_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies when the relationship carries no capabilities at all', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow({ capabilities: [] })],
      });

      await expect(
        service.guardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies when no active relationship exists (suspended or revoked link)', async () => {
      // A suspended/revoked/expired link is excluded by the SQL predicates, so
      // the guardian resolves with an empty link list.
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [],
      });

      await expect(
        service.guardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies when the child belongs to another guardian or tenant', async () => {
      // Cross-tenant and unrelated-child both surface as "no guardian row",
      // because the query is scoped by tenantId and userId.
      prisma.guardian.findFirst.mockResolvedValue(null);

      await expect(
        service.guardianCapability(
          parentActor,
          'other-tenant-student',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies a link that resolves to a different student', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow({ studentId: 'someone-elses-child' })],
      });

      await expect(
        service.guardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies actors without a parent or guardian role without querying', async () => {
      const staffActor = { ...parentActor, roles: ['teacher'] } as AuthContext;

      await expect(
        service.guardianCapability(
          staffActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.guardian.findFirst).not.toHaveBeenCalled();
    });

    it('resolves several capabilities for one child with a single query', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow()],
      });

      await service.guardianCapability(
        parentActor,
        'student-1',
        GuardianCapability.ACADEMICS_VIEW,
      );
      await service.guardianCapability(
        parentActor,
        'student-1',
        GuardianCapability.ATTENDANCE_VIEW,
      );
      await service.guardianCapability(
        parentActor,
        'student-1',
        GuardianCapability.FEES_VIEW,
      );

      // This is the optimization itself: four dashboard sub-services checking
      // four capabilities for one child must not issue four query pairs.
      expect(prisma.guardian.findFirst).toHaveBeenCalledTimes(1);
    });

    it('keeps separate children on separate cache entries', async () => {
      prisma.guardian.findFirst
        .mockResolvedValueOnce({ id: 'guardian-1', studentLinks: [linkRow()] })
        .mockResolvedValueOnce({
          id: 'guardian-1',
          studentLinks: [linkRow({ studentId: 'student-2', id: 'link-2' })],
        });

      await service.guardianCapability(
        parentActor,
        'student-1',
        GuardianCapability.ACADEMICS_VIEW,
      );
      await service.guardianCapability(
        parentActor,
        'student-2',
        GuardianCapability.ACADEMICS_VIEW,
      );

      expect(prisma.guardian.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('tryGuardianCapability', () => {
    it('returns the relationship when held', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow()],
      });

      await expect(
        service.tryGuardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).resolves.toEqual(expect.objectContaining({ guardianId: 'guardian-1' }));
    });

    it('returns null instead of throwing when the capability is missing', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow({ capabilities: [] })],
      });

      await expect(
        service.tryGuardianCapability(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).resolves.toBeNull();
    });
  });

  describe('allowedStudentIds', () => {
    it('returns every linked child for a parent with multiple children', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        studentLinks: [
          {
            studentId: 'student-1',
            capabilities: [GuardianCapability.FEES_VIEW],
          },
          {
            studentId: 'student-2',
            capabilities: [GuardianCapability.FEES_VIEW],
          },
        ],
      });

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([
        'student-1',
        'student-2',
      ]);
    });

    it('returns an empty list for a parent with no active relationships', async () => {
      prisma.guardian.findFirst.mockResolvedValue({ studentLinks: [] });

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([]);
    });

    it('returns an empty list when no guardian record exists', async () => {
      prisma.guardian.findFirst.mockResolvedValue(null);

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([]);
    });

    it('filters by capability without issuing another query', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        studentLinks: [
          {
            studentId: 'student-1',
            capabilities: [
              GuardianCapability.ACADEMICS_VIEW,
              GuardianCapability.FEES_VIEW,
            ],
          },
          {
            studentId: 'student-2',
            capabilities: [GuardianCapability.ACADEMICS_VIEW],
          },
        ],
      });

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([
        'student-1',
        'student-2',
      ]);
      await expect(
        service.allowedStudentIds(parentActor, GuardianCapability.FEES_VIEW),
      ).resolves.toEqual(['student-1']);

      expect(prisma.guardian.findFirst).toHaveBeenCalledTimes(1);
    });

    it('scopes the lookup to the acting tenant and user', async () => {
      prisma.guardian.findFirst.mockResolvedValue({ studentLinks: [] });

      await service.allowedStudentIds(parentActor);

      expect(prisma.guardian.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', userId: 'parent-1' },
        }),
      );
    });
  });

  describe('assertStudentAccess', () => {
    it('raises NotFound before any capability check when the student is absent', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.assertStudentAccess(
          parentActor,
          'ghost-student',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Ordering matters: an unrelated parent must not be able to distinguish
      // "no such student" from "not your child" by the capability query firing.
      expect(prisma.guardian.findFirst).not.toHaveBeenCalled();
    });

    it('raises Forbidden when the student exists but the capability is missing', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow({ capabilities: [] })],
      });

      await expect(
        service.assertStudentAccess(
          parentActor,
          'student-1',
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reuses the student existence check across sub-services', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'guardian-1',
        studentLinks: [linkRow()],
      });

      await service.assertStudentAccess(
        parentActor,
        'student-1',
        GuardianCapability.ACADEMICS_VIEW,
      );
      await service.assertStudentAccess(
        parentActor,
        'student-1',
        GuardianCapability.ATTENDANCE_VIEW,
      );

      expect(prisma.student.findFirst).toHaveBeenCalledTimes(1);
    });

    it('scopes the student lookup to the acting tenant', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });

      await service.assertStudentAccess(parentActor, 'student-1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'student-1',
            tenantId: 'tenant-1',
            lifecycleStatus: 'ACTIVE',
            enrollments: { some: { status: 'ACTIVE' } },
          }),
        }),
      );
    });
  });

  describe('current academic year', () => {
    it('resolves the current year once per request', async () => {
      prisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        name: '2026-2027',
      });

      await service.currentAcademicYear(parentActor);
      await service.currentAcademicYear(parentActor);

      expect(prisma.academicYear.findFirst).toHaveBeenCalledTimes(1);
    });

    it('returns null when the tenant has no current year configured', async () => {
      prisma.academicYear.findFirst.mockResolvedValue(null);

      await expect(
        service.currentAcademicYear(parentActor),
      ).resolves.toBeNull();
    });
  });

  describe('cross-actor isolation', () => {
    it('never serves one parent a value memoized for another', async () => {
      // The cache is request-scoped so two actors cannot share one in practice.
      // This asserts the key namespacing that makes that true by construction.
      const otherParent = {
        ...parentActor,
        userId: 'parent-2',
      } as AuthContext;

      prisma.guardian.findFirst
        .mockResolvedValueOnce({
          studentLinks: [{ studentId: 'child-of-1', capabilities: [] }],
        })
        .mockResolvedValueOnce({
          studentLinks: [{ studentId: 'child-of-2', capabilities: [] }],
        });

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([
        'child-of-1',
      ]);
      await expect(service.allowedStudentIds(otherParent)).resolves.toEqual([
        'child-of-2',
      ]);
    });

    it('never serves one tenant a value memoized for another', async () => {
      const otherTenantActor = {
        ...parentActor,
        tenantId: 'tenant-2',
      } as AuthContext;

      prisma.guardian.findFirst
        .mockResolvedValueOnce({
          studentLinks: [{ studentId: 'student-t1', capabilities: [] }],
        })
        .mockResolvedValueOnce({
          studentLinks: [{ studentId: 'student-t2', capabilities: [] }],
        });

      await expect(service.allowedStudentIds(parentActor)).resolves.toEqual([
        'student-t1',
      ]);
      await expect(
        service.allowedStudentIds(otherTenantActor),
      ).resolves.toEqual(['student-t2']);
    });
  });
});
