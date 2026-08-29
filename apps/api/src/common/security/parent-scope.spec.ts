import { ForbiddenException } from '@nestjs/common';
import { AuthMethod, GuardianCapability } from '@prisma/client';
import { systemRolePermissions } from '@schoolos/core';
import type { AuthContext } from '../../auth/auth.types';
import {
  buildActiveGuardianRelationshipWhere,
  GUARDIAN_CAPABILITY_DENIED_CODE,
  getParentStudentIds,
  getStudentOwnId,
  requireGuardianCapability,
} from './parent-scope';

describe('guardian-child capability scope', () => {
  const actor: AuthContext = {
    userId: 'parent-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'parent@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['parent'],
    permissions: [],
  };

  it('audits guardian capability denials when an audit sink is provided', async () => {
    const prisma = {
      guardian: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };

    await expect(
      requireGuardianCapability(
        prisma as never,
        actor,
        'student-other',
        GuardianCapability.ACADEMICS_VIEW,
        audit,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: GUARDIAN_CAPABILITY_DENIED_CODE,
      }),
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authorization.denied',
        resource: 'guardian_relationship',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: 'student-other',
        after: expect.objectContaining({
          reason: 'guardian_capability_denied',
          capability: GuardianCapability.ACADEMICS_VIEW,
        }),
      }),
    );
  });

  it('keeps the parent role off the administrative student API', () => {
    expect(systemRolePermissions.parent).not.toContain('students:read');
  });

  it('lists only active, verified, approved, effective linked children', async () => {
    const prisma = {
      guardian: {
        findFirst: jest.fn().mockResolvedValue({
          studentLinks: [{ studentId: 'student-1' }],
        }),
      },
    };

    await expect(
      getParentStudentIds(
        prisma as never,
        actor,
        GuardianCapability.ATTENDANCE_VIEW,
      ),
    ).resolves.toEqual(['student-1']);

    expect(prisma.guardian.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
        },
        select: {
          studentLinks: expect.objectContaining({
            where: expect.objectContaining({
              status: 'ACTIVE',
              verificationStatus: 'VERIFIED',
              approvalStatus: 'APPROVED',
              student: expect.objectContaining({
                lifecycleStatus: 'ACTIVE',
              }),
            }),
          }),
        },
      }),
    );
    const relationshipWhere =
      prisma.guardian.findFirst.mock.calls[0][0].select.studentLinks.where;
    expect(relationshipWhere.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { effectiveUntil: null },
            { effectiveUntil: { gt: expect.any(Date) } },
          ]),
        }),
        { capabilities: { has: GuardianCapability.ATTENDANCE_VIEW } },
      ]),
    );
  });

  it('grants only the requested capability for the same linked child', async () => {
    const relationship = {
      id: 'link-1',
      studentId: 'student-1',
      guardianId: 'guardian-1',
      relation: 'GRANDPARENT',
      capabilities: [GuardianCapability.ATTENDANCE_VIEW],
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveUntil: null,
      emergencyContactPriority: 1,
    };
    const prisma = {
      guardian: {
        findFirst: jest.fn(
          (query: {
            where: {
              studentLinks: {
                some: { AND: Array<Record<string, unknown>> };
              };
            };
          }) => {
            const capabilityClause = query.where.studentLinks.some.AND.find(
              (clause) => 'capabilities' in clause,
            ) as { capabilities?: { has?: GuardianCapability } } | undefined;
            return Promise.resolve(
              capabilityClause?.capabilities?.has ===
                GuardianCapability.ATTENDANCE_VIEW
                ? { id: 'guardian-1', studentLinks: [relationship] }
                : null,
            );
          },
        ),
      },
    };

    await expect(
      requireGuardianCapability(
        prisma as never,
        actor,
        'student-1',
        GuardianCapability.ATTENDANCE_VIEW,
      ),
    ).resolves.toEqual(relationship);

    await expect(
      requireGuardianCapability(
        prisma as never,
        actor,
        'student-1',
        GuardianCapability.ACADEMICS_VIEW,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: GUARDIAN_CAPABILITY_DENIED_CODE,
        capability: GuardianCapability.ACADEMICS_VIEW,
      }),
    });
  });

  it('uses one denial envelope for absent, expired, suspended, or revoked scope', async () => {
    const prisma = {
      guardian: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(
      requireGuardianCapability(
        prisma as never,
        actor,
        'student-1',
        GuardianCapability.FEES_VIEW,
      ),
    ).rejects.toMatchObject({
      constructor: ForbiddenException,
      response: expect.objectContaining({
        code: GUARDIAN_CAPABILITY_DENIED_CODE,
      }),
    });
    const now = new Date('2026-07-28T00:00:00.000Z');
    expect(
      buildActiveGuardianRelationshipWhere(now, GuardianCapability.FEES_VIEW),
    ).toEqual({
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      approvalStatus: 'APPROVED',
      effectiveFrom: { lte: now },
      AND: [
        {
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
        { capabilities: { has: GuardianCapability.FEES_VIEW } },
      ],
    });
  });

  it('resolves student self scope only from an active tenant profile', async () => {
    const studentActor: AuthContext = {
      ...actor,
      userId: 'student-user-1',
      roles: ['student'],
    };
    const prisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue({ id: 'student-1' }),
      },
    };

    await expect(getStudentOwnId(prisma as never, studentActor)).resolves.toBe(
      'student-1',
    );
    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        userId: studentActor.userId,
        lifecycleStatus: 'ACTIVE',
      },
      select: { id: true },
    });
  });

  it('denies student self scope when no active profile remains linked', async () => {
    const studentActor: AuthContext = {
      ...actor,
      userId: 'merged-student-user',
      roles: ['student'],
    };
    const prisma = {
      student: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(
      getStudentOwnId(prisma as never, studentActor),
    ).rejects.toThrow('No student profile linked to this account');
  });
});
