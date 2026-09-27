import { grantAllows, scopesMatch } from './scopes/scope-resolver';
import { Injectable, Logger } from '@nestjs/common';
import { SecurityDomain } from '@prisma/client';
import {
  getCanonicalPermissionByCode,
  getCanonicalPermissionForLegacyKey,
  hasEffectivePermission,
  isPlatformRoleName,
  PLATFORM_ROLE_NAMES,
  type CanonicalPermissionDefinition,
} from '@schoolos/core';
import {
  AUTHORIZATION_REASON_CODES,
  AUTHORIZATION_STAGES,
  type AuthorizationContext,
  type AuthorizationDecision,
  type AuthorizationReasonCode,
  type AuthorizationStage,
  type PolicyEvaluation,
  type PolicyEvaluator,
} from './authorization.types';
import { SERVICE_AUTHORIZATION_POLICIES } from './service-authorization.decorator';

const reasonCodes = new Set<string>(AUTHORIZATION_REASON_CODES);
const servicePolicies = new Set<string>(SERVICE_AUTHORIZATION_POLICIES);
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const resolvePermission = (key: string) =>
  getCanonicalPermissionForLegacyKey(key) ?? getCanonicalPermissionByCode(key);
const isActive = (value: unknown): value is true => value === true;
const NA: PolicyEvaluation = Object.freeze({ outcome: 'NOT_APPLICABLE' });
const deny = (reasonCode: AuthorizationReasonCode): PolicyEvaluation => ({
  outcome: 'DENY',
  reasonCode,
});

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  /** ALLOW covers supplied generic checks, not unregistered domain policies. */
  async evaluate(
    input: AuthorizationContext,
    evaluators: readonly PolicyEvaluator[] = [],
  ): Promise<AuthorizationDecision> {
    let stage: AuthorizationStage = 'AUTHENTICATION';
    let policyId = 'builtin.AUTHENTICATION';
    try {
      const actor = input.actor
        ? Object.freeze({
            ...input.actor,
            accessGrants: input.actor.accessGrants
              ? Object.freeze(
                  input.actor.accessGrants.map((grant) =>
                    Object.freeze({
                      ...grant,
                      permissions: Object.freeze([...grant.permissions]),
                      scopes: Object.freeze(
                        grant.scopes.map((scope) =>
                          Object.freeze({
                            ...scope,
                            effectiveFrom: new Date(
                              scope.effectiveFrom,
                            ).toISOString(),
                            expiresAt: scope.expiresAt
                              ? new Date(scope.expiresAt).toISOString()
                              : null,
                            revokedAt: scope.revokedAt
                              ? new Date(scope.revokedAt).toISOString()
                              : null,
                          }),
                        ),
                      ),
                    }),
                  ),
                )
              : undefined,
            roles: Object.freeze([...input.actor.roles]) as unknown as string[],
            supportOverrideScopes: input.actor.supportOverrideScopes
              ? (Object.freeze([
                  ...input.actor.supportOverrideScopes,
                ]) as unknown as NonNullable<
                  typeof input.actor.supportOverrideScopes
                >)
              : undefined,
            permissions: Object.freeze([
              ...input.actor.permissions,
            ]) as unknown as string[],
          })
        : undefined;
      const definitions = input.requestedPermissions.map(resolvePermission);
      let context: AuthorizationContext = Object.freeze({
        ...input,
        actor,
        resourceScope: input.resourceScope
          ? Object.freeze({ ...input.resourceScope })
          : undefined,
        identity: input.identity
          ? Object.freeze({ ...input.identity })
          : undefined,
        resource: input.resource
          ? Object.freeze({ ...input.resource })
          : undefined,
        entitlement: input.entitlement
          ? Object.freeze({
              keys: Object.freeze([...input.entitlement.keys]),
              evaluate: input.entitlement.evaluate,
            })
          : undefined,
        requestedPermissions: Object.freeze([...input.requestedPermissions]),
        requiredRoles: Object.freeze([...(input.requiredRoles ?? [])]),
        canonicalPermissions: Object.freeze(
          definitions.filter(
            (d): d is CanonicalPermissionDefinition => d !== null,
          ),
        ),
      });
      const registered = evaluators.map((evaluator) =>
        Object.freeze({
          id: evaluator.id,
          stage: evaluator.stage,
          evaluate: evaluator.evaluate.bind(
            evaluator,
          ) as PolicyEvaluator['evaluate'],
        }),
      );
      const ids = new Set<string>();
      for (const evaluator of registered) {
        if (
          !AUTHORIZATION_STAGES.includes(evaluator.stage) ||
          !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(evaluator.id) ||
          evaluator.id.startsWith('builtin.') ||
          ids.has(evaluator.id)
        ) {
          throw new Error('Invalid evaluator configuration');
        }
        ids.add(evaluator.id);
      }
      const ordered = [...registered].sort(
        (a, b) =>
          AUTHORIZATION_STAGES.indexOf(a.stage) -
            AUTHORIZATION_STAGES.indexOf(b.stage) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );

      for (stage of AUTHORIZATION_STAGES) {
        policyId = `builtin.${stage}`;
        if (stage === 'RESOURCE_TENANT' && context.resourceLookup) {
          const owned = await context.resourceLookup();
          if (!owned)
            return this.finish(
              context,
              this.decision('RESOURCE_NOT_FOUND', stage, policyId, definitions),
            );
          context = Object.freeze({
            ...context,
            resource: Object.freeze({ id: owned.id, tenantId: owned.tenantId }),
            resourceScope: Object.freeze({ ...owned.scope }),
          });
        }
        const result = await this.evaluateBuiltin(stage, context, definitions);
        if (result.outcome === 'DENY') {
          return this.finish(
            context,
            this.decision(
              result.reasonCode ?? 'POLICY_DENIED',
              stage,
              policyId,
              definitions,
            ),
          );
        }
        for (const evaluator of ordered.filter(
          (item) => item.stage === stage,
        )) {
          policyId = evaluator.id;
          const evaluation = await evaluator.evaluate(context);
          if (
            !evaluation ||
            !['ALLOW', 'DENY', 'NOT_APPLICABLE'].includes(evaluation.outcome) ||
            (evaluation.reasonCode !== undefined &&
              (!reasonCodes.has(evaluation.reasonCode) ||
                (evaluation.outcome === 'DENY' &&
                  evaluation.reasonCode === 'ALLOWED')))
          ) {
            throw new Error('Invalid evaluator result');
          }
          if (evaluation.outcome === 'DENY') {
            return this.finish(
              context,
              this.decision(
                evaluation.reasonCode ?? 'POLICY_DENIED',
                stage,
                policyId,
                definitions,
              ),
            );
          }
        }
      }
      return this.finish(
        context,
        Object.freeze({
          outcome: 'ALLOW',
          reasonCode: 'ALLOWED',
          stage: 'AUDIT',
          policyId: 'authorization.generic',
          ...(definitions.length === 1 && definitions[0]
            ? { canonicalPermission: definitions[0].code }
            : {}),
        }),
      );
    } catch {
      // Never log an evaluator's thrown object, message, stack, actor or URL.
      const decision = this.decision(
        'AUTHORIZATION_EVALUATION_ERROR',
        stage,
        /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(policyId)
          ? policyId
          : 'authorization.invalid_policy',
        [],
      );
      this.logger.error(
        JSON.stringify({
          outcome: decision.outcome,
          reasonCode: decision.reasonCode,
          stage: decision.stage,
          policyId: decision.policyId,
        }),
      );
      return decision;
    }
  }

  private async evaluateBuiltin(
    stage: AuthorizationStage,
    context: AuthorizationContext,
    definitions: ReadonlyArray<CanonicalPermissionDefinition | null>,
  ): Promise<PolicyEvaluation> {
    const { actor, identity } = context;
    switch (stage) {
      case 'AUTHENTICATION':
        return actor?.userId ? NA : deny('AUTHENTICATION_REQUIRED');
      case 'ACTIVE_USER_SESSION':
        return identity?.userSessionActive === true
          ? NA
          : deny('USER_OR_SESSION_INACTIVE');
      case 'SECURITY_DOMAIN': {
        const actual = identity?.securityDomain;
        const support =
          actual === SecurityDomain.PLATFORM &&
          actor?.isSupportOverride === true;
        if (
          !actual ||
          (actual !== context.securityDomain &&
            !(support && context.securityDomain === SecurityDomain.SCHOOL)) ||
          (actor?.securityDomain !== undefined &&
            actor.securityDomain !== actual) ||
          (actual === SecurityDomain.SCHOOL &&
            actor?.roles.some(isPlatformRoleName)) ||
          (context.securityDomain === SecurityDomain.PLATFORM &&
            (support ||
              !actor?.roles.some((role) =>
                PLATFORM_ROLE_NAMES.some((name) => name === role),
              ))) ||
          definitions.some(
            (definition) =>
              definition !== null &&
              (definition.module === 'platform') !==
                (context.securityDomain === SecurityDomain.PLATFORM),
          )
        ) {
          return deny('SECURITY_DOMAIN_MISMATCH');
        }
        return NA;
      }
      case 'TENANT':
        if (
          !context.trustedTenantId ||
          context.trustedTenantId !== actor?.tenantId ||
          context.trustedTenantId !== identity?.tenantId
        )
          return deny('TENANT_MISMATCH');
        return isActive(identity.tenantActive) ? NA : deny('TENANT_INACTIVE');
      case 'RESOURCE_TENANT':
        return context.resource &&
          (!context.resource.tenantId ||
            context.resource.tenantId !== context.trustedTenantId)
          ? deny('RESOURCE_TENANT_MISMATCH')
          : NA;
      case 'ENTITLEMENT':
        return context.entitlement && !(await context.entitlement.evaluate())
          ? deny('ENTITLEMENT_MISSING')
          : NA;
      case 'HARD_RESTRICTION': {
        const noMetadata =
          context.requestedPermissions.length === 0 &&
          (context.requiredRoles?.length ?? 0) === 0;
        if (
          actor?.isSupportOverride &&
          (identity?.supportOverrideApproved !== true ||
            actor.supportOverrideReadOnly !== true ||
            !actor.originalTenantId ||
            actor.originalTenantId === actor.tenantId ||
            !readMethods.has((context.method ?? '').toUpperCase()) ||
            (context.requiredRoles?.length ?? 0) > 0 ||
            context.requestedPermissions.length === 0)
        )
          return deny('POLICY_DENIED');
        if (
          context.securityDomain === SecurityDomain.PLATFORM &&
          context.requestedPermissions.length === 0
        )
          return deny('POLICY_DENIED');
        if (
          noMetadata &&
          (!context.serviceAuthorizationPolicy ||
            !servicePolicies.has(context.serviceAuthorizationPolicy))
        )
          return deny('POLICY_DENIED');
        return NA;
      }
      case 'PERMISSION': {
        if (definitions.some((definition) => definition === null))
          return deny('UNKNOWN_PERMISSION');
        if (
          context.requiredRoles?.length &&
          !context.requiredRoles.some((role) => actor?.roles.includes(role))
        )
          return deny('ROLE_MISSING');
        const grants =
          (actor?.accessGrants && !actor.isSupportOverride
            ? actor.accessGrants.flatMap((g) => [...g.permissions])
            : actor?.permissions
          )?.map((key) => resolvePermission(key)?.legacyKey ?? key) ?? [];
        for (const definition of definitions) {
          if (!definition) return deny('UNKNOWN_PERMISSION');
          const exact =
            actor?.isSupportOverride ||
            context.securityDomain === SecurityDomain.PLATFORM;
          if (
            !(exact
              ? grants.includes(definition.legacyKey)
              : hasEffectivePermission(grants, definition.legacyKey))
          )
            return deny('PERMISSION_MISSING');
        }
        return NA;
      }
      case 'SCOPE':
        if (
          !actor?.accessGrants ||
          actor.isSupportOverride ||
          context.securityDomain === SecurityDomain.PLATFORM
        )
          return NA;
        if (
          context.requiredRoles?.length &&
          !actor.accessGrants.some(
            (grant) =>
              context.requiredRoles?.includes(grant.role) &&
              grant.scopes.length === 1 &&
              grant.scopes[0].scopeType === 'TENANT' &&
              grant.tenantId === context.trustedTenantId &&
              scopesMatch(grant.scopes, context.trustedTenantId ?? ''),
          )
        )
          return deny('SCOPE_MISMATCH');
        return context.requestedPermissions.every((permission) =>
          actor.accessGrants?.some((grant) =>
            grantAllows(
              grant,
              permission,
              context.trustedTenantId ?? '',
              context.resourceScope,
            ),
          ),
        )
          ? NA
          : deny('SCOPE_MISMATCH');
      default:
        // Relationship/lifecycle/SoD/step-up/projection are extension
        // points. Existing domain services still enforce their own policies.
        return NA;
    }
  }

  private decision(
    reasonCode: AuthorizationReasonCode,
    stage: AuthorizationStage,
    policyId: string,
    definitions: ReadonlyArray<CanonicalPermissionDefinition | null>,
  ): AuthorizationDecision {
    return Object.freeze({
      outcome: 'DENY',
      reasonCode,
      stage,
      policyId,
      ...(definitions.length === 1 && definitions[0]
        ? { canonicalPermission: definitions[0].code }
        : {}),
    });
  }

  private finish(
    context: AuthorizationContext,
    decision: AuthorizationDecision,
  ): AuthorizationDecision {
    if (decision.outcome === 'DENY') {
      this.logger.warn(
        JSON.stringify({
          outcome: decision.outcome,
          reasonCode: decision.reasonCode,
          stage: decision.stage,
          policyId: decision.policyId,
          ...(context.requestId &&
          /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(context.requestId)
            ? { requestId: context.requestId }
            : {}),
        }),
      );
    }
    return decision;
  }
}
