import { Injectable, NotFoundException } from '@nestjs/common';
import { GuardianCapability, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { RequestCacheService } from '../common/cache/request-cache.service';
import {
  buildActiveGuardianRelationshipWhere,
  createGuardianCapabilityDeniedException,
  getParentStudentIds,
  isParentOnly,
} from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Request-scoped resolver for the parent/child scope values that the mobile
 * parent endpoints need repeatedly.
 *
 * ## Why this exists
 *
 * `GET mobile/me/dashboard` composes eight sub-services. Each one independently
 * re-resolved the same guardian record, the same child roster, and the same
 * per-child authorization, because each is also a standalone endpoint and so
 * has to be self-sufficient. Measured on one dashboard request against the
 * 1,500-student performance tenant, that produced 151 SQL statements, of which:
 *
 *   StudentGuardian  22    Guardian  14
 *   Student          13    Enrollment 16
 *   Section           8    Class      8    Staff 4
 *
 * — roughly 65 statements (43%) spent re-deriving facts that cannot change
 * within a single request.
 *
 * ## Why memoization rather than rewriting the checks
 *
 * Every authorization check still runs exactly as before, with the same query,
 * the same `where` clause, and the same denial envelope. This class only
 * prevents the *identical* check from being issued a second time inside one
 * request. Nothing is skipped, relaxed, or inferred:
 *
 *  - scope is one request (see `RequestCacheService`), so a revoked
 *    relationship, a suspended guardian, or a deactivated student is observed
 *    on the very next request;
 *  - keys are namespaced by `tenantId` **and** `userId`, so a memoized answer
 *    can never be served to a different tenant or a different parent even if
 *    the cache outlived the request;
 *  - rejected lookups are evicted by `RequestCacheService`, so a denial is
 *    never pinned;
 *  - outside a request context (queue workers, cron) there is no CLS store and
 *    every call falls through to a live query.
 *
 * This is deliberately not a Redis cache. Child-scoped authorization is exactly
 * the data the program brief forbids caching without a documented invalidation
 * policy, and a request-scoped reuse needs none.
 */
@Injectable()
export class ParentScopeContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestCache: RequestCacheService,
  ) {}

  /** Namespaced so a memoized value can only ever be reused for the same actor. */
  private key(actor: AuthContext, parts: string) {
    return `parentScope:${actor.tenantId}:${actor.userId}:${parts}`;
  }

  /**
   * Student ids this parent may access, optionally filtered by capability.
   * Backs `listMyStudents` and the notification child fan-out, which both run
   * on every dashboard request.
   */
  async allowedStudentIds(
    actor: AuthContext,
    capability?: GuardianCapability,
  ): Promise<string[]> {
    if (!isParentOnly(actor)) {
      // Preserves `getParentStudentIds`' contract: non-parents are unrestricted
      // there and callers handle that separately.
      return (await getParentStudentIds(this.prisma, actor, capability)) ?? [];
    }

    // One query for all active links regardless of capability, then filter in
    // memory. Keying by capability issued a separate Guardian +
    // StudentGuardian pair per capability for the same underlying rows.
    const links = await this.requestCache.resolve(
      this.key(actor, 'allowedStudentLinks'),
      async () => {
        const guardian = await this.prisma.guardian.findFirst({
          where: { tenantId: actor.tenantId, userId: actor.userId },
          select: {
            studentLinks: {
              where: {
                ...buildActiveGuardianRelationshipWhere(),
                student: {
                  lifecycleStatus: 'ACTIVE',
                  enrollments: { some: { status: 'ACTIVE' } },
                },
              },
              select: { studentId: true, capabilities: true },
            },
          },
        });

        return guardian?.studentLinks ?? [];
      },
    );

    return links
      .filter((link) => !capability || link.capabilities.includes(capability))
      .map((link) => link.studentId);
  }

  /**
   * This parent's active, verified, approved, in-window guardian link for
   * `studentId` — **without** filtering on any capability.
   *
   * Keyed by child only, so all capability checks for one child in one request
   * share a single query. The dashboard checks four different capabilities
   * (ACADEMICS_VIEW, ATTENDANCE_VIEW, FEES_VIEW, EMERGENCY_ALERT_RECEIVE);
   * keying by capability meant four Guardian + StudentGuardian query pairs for
   * the same relationship row.
   *
   * Returns null rather than throwing so the caller owns the denial envelope.
   */
  private async activeGuardianLink(actor: AuthContext, studentId: string) {
    return this.requestCache.resolve(
      this.key(actor, `link:${studentId}`),
      async () => {
        const guardian = await this.prisma.guardian.findFirst({
          where: {
            tenantId: actor.tenantId,
            userId: actor.userId,
            studentLinks: {
              some: {
                tenantId: actor.tenantId,
                studentId,
                ...buildActiveGuardianRelationshipWhere(new Date()),
              },
            },
          },
          select: {
            id: true,
            studentLinks: {
              where: {
                tenantId: actor.tenantId,
                studentId,
                ...buildActiveGuardianRelationshipWhere(new Date()),
              },
              select: {
                id: true,
                studentId: true,
                guardianId: true,
                relation: true,
                capabilities: true,
                effectiveFrom: true,
                effectiveUntil: true,
                emergencyContactPriority: true,
              },
              take: 1,
            },
          },
        });

        return guardian?.studentLinks?.[0] ?? null;
      },
    );
  }

  /**
   * Non-throwing variant, for call sites that raise their own error shape.
   * Returns the relationship when the capability is held, otherwise null.
   * Same predicate as {@link guardianCapability}.
   */
  async tryGuardianCapability(
    actor: AuthContext,
    studentId: string,
    capability: GuardianCapability,
  ) {
    if (!actor.roles.includes('parent') && !actor.roles.includes('guardian')) {
      return null;
    }

    const relationship = await this.activeGuardianLink(actor, studentId);

    if (
      !relationship ||
      relationship.studentId !== studentId ||
      !relationship.capabilities.includes(capability)
    ) {
      return null;
    }

    return relationship;
  }

  /**
   * The active guardian relationship carrying `capability` for `studentId`.
   *
   * Semantically identical to `requireGuardianCapability`: it requires the
   * parent/guardian role, an active-verified-approved-in-window relationship
   * for *this* student, and the capability on that relationship — and it
   * raises the same stable denial envelope for every failure mode, so callers
   * cannot distinguish "no relationship" from "capability missing".
   *
   * The only change is where the capability predicate is evaluated: the
   * database applied `capabilities has $capability`; this applies the same test
   * to the same column in memory, against the row that satisfied all the other
   * predicates. `GuardianCapability[]` is a scalar list on `StudentGuardian`,
   * so the row already carries the full set.
   */
  async guardianCapability(
    actor: AuthContext,
    studentId: string,
    capability: GuardianCapability,
  ) {
    if (!actor.roles.includes('parent') && !actor.roles.includes('guardian')) {
      throw createGuardianCapabilityDeniedException(capability);
    }

    const relationship = await this.activeGuardianLink(actor, studentId);

    if (
      !relationship ||
      relationship.studentId !== studentId ||
      !relationship.capabilities.includes(capability)
    ) {
      throw createGuardianCapabilityDeniedException(capability);
    }

    return relationship;
  }

  /**
   * Existence check for an active, currently-enrolled student in this tenant.
   * Returns null when absent so the caller keeps ownership of the error shape.
   */
  async activeStudent(actor: AuthContext, studentId: string) {
    return this.requestCache.resolve(
      this.key(actor, `activeStudent:${studentId}`),
      () =>
        this.prisma.student.findFirst({
          where: {
            id: studentId,
            tenantId: actor.tenantId,
            lifecycleStatus: 'ACTIVE',
            enrollments: { some: { status: 'ACTIVE' } },
          },
          select: { id: true },
        }),
    );
  }

  /**
   * The full student row the parent endpoints render, with class, section,
   * class teacher, and this parent's own guardian links.
   *
   * `include` is unchanged from the original call site so the mapped response
   * shape is byte-identical; only the number of times it is issued changes.
   */
  async accessibleStudent<TInclude extends Prisma.StudentInclude>(
    actor: AuthContext,
    studentId: string,
    include: TInclude,
  ): Promise<Prisma.StudentGetPayload<{ include: TInclude }> | null> {
    // Generic over the include so callers keep Prisma's precise payload type.
    // Widening the parameter to `Prisma.StudentInclude` silently erases the
    // scalar fields from the inferred result and breaks callers that read them.
    return this.requestCache.resolve(
      this.key(actor, `accessibleStudent:${studentId}`),
      () =>
        this.prisma.student.findFirst({
          where: {
            id: studentId,
            tenantId: actor.tenantId,
            lifecycleStatus: 'ACTIVE',
            enrollments: { some: { status: 'ACTIVE' } },
          },
          include,
        }) as Promise<Prisma.StudentGetPayload<{ include: TInclude }> | null>,
    );
  }

  /**
   * Seed the accessible-student entry from a row already fetched by a
   * set-based query, so a later per-child lookup in the same request is a cache
   * hit instead of a second query cluster.
   *
   * The caller must have loaded the row with the *same* predicates
   * (`tenantId`, `lifecycleStatus: ACTIVE`, an active enrollment) and the same
   * include, otherwise a later reader would see a different shape than it
   * asked for. `listMyStudents` is the only caller and satisfies both.
   *
   * Priming does not bypass authorization: `assertStudentAccess` still runs its
   * own capability check before any caller receives this row.
   */
  primeAccessibleStudent(
    actor: AuthContext,
    studentId: string,
    student: unknown,
  ) {
    void this.requestCache.resolve(
      this.key(actor, `accessibleStudent:${studentId}`),
      () => Promise.resolve(student),
    );
  }

  /** This parent's guardian record id, or null when none is linked. */
  async guardianRecord(actor: AuthContext) {
    return this.requestCache.resolve(this.key(actor, 'guardian'), () =>
      this.prisma.guardian.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true },
      }),
    );
  }

  /**
   * The tenant's current academic year. Re-derived by several sub-services on
   * every request even though it changes once a year.
   */
  async currentAcademicYear(actor: AuthContext) {
    return this.requestCache.resolve(this.key(actor, 'academicYear'), () =>
      this.prisma.academicYear.findFirst({
        where: { tenantId: actor.tenantId, isCurrent: true },
        select: { id: true, name: true, startsOn: true, endsOn: true },
      }),
    );
  }

  /**
   * Active guardian-link rows for a set of students, in one set-based query
   * instead of one query per child. Ordering is explicit so multi-child output
   * stays deterministic.
   */
  async guardianLinksForStudents(actor: AuthContext, studentIds: string[]) {
    if (studentIds.length === 0) return [];

    const sorted = [...studentIds].sort();
    return this.requestCache.resolve(
      this.key(actor, `links:${sorted.join(',')}`),
      () =>
        this.prisma.studentGuardian.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId: { in: sorted },
            ...buildActiveGuardianRelationshipWhere(),
            guardian: { userId: actor.userId },
          },
          select: {
            studentId: true,
            capabilities: true,
            isPrimary: true,
            relation: true,
          },
          orderBy: [{ studentId: 'asc' }, { isPrimary: 'desc' }],
        }),
    );
  }

  /**
   * Assert the student exists and, when a capability is given, that this parent
   * holds it. Preserves the original ordering — student existence is checked
   * before the capability — so the error a caller sees is unchanged.
   */
  async assertStudentAccess(
    actor: AuthContext,
    studentId: string,
    capability?: GuardianCapability,
  ) {
    const student = await this.activeStudent(actor, studentId);
    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    if (capability) {
      await this.guardianCapability(actor, studentId, capability);
    }

    return student;
  }
}
