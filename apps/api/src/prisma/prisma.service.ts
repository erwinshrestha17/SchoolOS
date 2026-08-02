import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';

export const TENANT_ID_KEY = 'tenantId';

/**
 * CLS flag set by `PrismaService.runWithoutTenantScope`. Marks a region where
 * cross-tenant access is intentional (platform-wide sweeps), so the fail-closed
 * check below stands down. Deliberately a separate key from TENANT_ID_KEY so a
 * bypass is always an explicit, greppable act rather than an absent value.
 */
export const TENANT_SCOPE_BYPASS_KEY = 'tenantScopeBypass';

/**
 * Thrown when a tenant-scoped model is queried with no tenant context and no
 * explicit bypass. Previously such queries silently ran unscoped across every
 * tenant; P0-01 requires them to fail closed instead.
 */
export class MissingTenantScopeError extends Error {
  constructor(
    readonly model: string,
    readonly operation: string,
  ) {
    super(
      `Refusing to run ${model}.${operation} without a tenant context. ` +
        'Tenant-scoped queries require a CLS tenantId (set by JwtAuthGuard or ' +
        'runTenantScopedJob). For intentional cross-tenant access, wrap the ' +
        'call in prisma.runWithoutTenantScope(reason, fn).',
    );
    this.name = 'MissingTenantScopeError';
  }
}
interface TenantScopedArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const TENANT_SCOPE_EXCLUDED_MODELS = [
  'Tenant',
  'Permission',
  'RefreshToken',
  'OtpCode',
  'RolePermission',
  'ProviderConfig',
  'PlatformPlan',
  'PlatformPlanFeature',
  // Nepal administrative geography reference data: global, shared by every
  // tenant, read-only outside platform reference-data administration.
  'NepalProvince',
  'NepalDistrict',
  'NepalLocalLevelType',
  'NepalLocalLevel',
  'ReferenceDatasetVersion',
];
const TENANT_SCOPED_READ_WRITE_OPERATIONS = [
  'findUnique',
  'findFirst',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
];
const TENANT_SCOPED_CREATE_OPERATIONS = ['create', 'createMany'];

export function applyTenantScopeToArgs<TArgs>(
  model: string,
  operation: string,
  args: TArgs,
  tenantId?: string,
  bypassTenantScope = false,
) {
  if (TENANT_SCOPE_EXCLUDED_MODELS.includes(model)) {
    return args;
  }

  const isReadWrite = TENANT_SCOPED_READ_WRITE_OPERATIONS.includes(operation);
  const isCreate = TENANT_SCOPED_CREATE_OPERATIONS.includes(operation);

  if (!isReadWrite && !isCreate) {
    return args;
  }

  if (!tenantId) {
    // Fail closed. Previously this returned `args` untouched, so any entry
    // point that forgot to populate CLS silently queried across every tenant.
    if (bypassTenantScope) {
      return args;
    }
    throw new MissingTenantScopeError(model, operation);
  }

  const scopedArgs = args as TenantScopedArgs;

  if (isReadWrite) {
    scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
  } else {
    scopedArgs.data = Array.isArray(scopedArgs.data)
      ? scopedArgs.data.map((data) => ({ ...data, tenantId }))
      : { ...(scopedArgs.data ?? {}), tenantId };
  }

  return args;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly _client: Record<string, unknown>;

  constructor(private readonly cls: ClsService) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
    this._client = this.client;

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === '$connect' ||
          prop === '$disconnect' ||
          // Must be served from the PrismaService instance, not the extended
          // client, or the Proxy below would shadow it.
          prop === 'runWithoutTenantScope' ||
          prop === 'runWithTenantScope'
        ) {
          const val = Reflect.get(target, prop, receiver);
          return typeof val === 'function' ? val.bind(target) : val;
        }
        const val = Reflect.get(target._client, prop);
        return typeof val === 'function' ? val.bind(target._client) : val;
      },
    });
  }

  get client() {
    const cls = this.cls;
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const tenantId = cls?.get(TENANT_ID_KEY);
            const bypass = Boolean(cls?.get(TENANT_SCOPE_BYPASS_KEY));
            return query(
              applyTenantScopeToArgs(model, operation, args, tenantId, bypass),
            );
          },
        },
      },
    });
  }

  /**
   * Runs `fn` scoped to one tenant, so queries inside are filtered exactly as
   * an authenticated request would be. Preferred over `runWithoutTenantScope`
   * for per-tenant loops in scheduled jobs: it keeps real isolation instead of
   * disabling it. (BullMQ processors should keep using `runTenantScopedJob`,
   * which additionally applies suspended-tenant checks.)
   */
  async runWithTenantScope<T>(tenantId: string, fn: () => Promise<T>) {
    if (!tenantId) {
      throw new Error('runWithTenantScope requires a tenantId');
    }

    const cls = this.cls;
    return cls.run(async () => {
      cls.set(TENANT_ID_KEY, tenantId);
      return fn();
    });
  }

  /**
   * Runs `fn` with the fail-closed tenant check suspended, for work that is
   * legitimately cross-tenant (platform-wide crons, billing sweeps, usage
   * rollups). `reason` is required so every bypass is self-documenting at the
   * call site and greppable in review.
   *
   * This does NOT inject a tenant filter -- queries inside see every tenant's
   * rows. Never wrap request-scoped work in it; use it only where operating
   * across tenants is the actual intent.
   */
  async runWithoutTenantScope<T>(
    reason: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!reason?.trim()) {
      throw new Error(
        'runWithoutTenantScope requires a non-empty reason describing why cross-tenant access is intended',
      );
    }

    const cls = this.cls;
    const hasActiveCls =
      typeof cls?.isActive === 'function' ? cls.isActive() : false;

    if (!hasActiveCls) {
      // No CLS context to write into (e.g. a bare scheduled callback): run the
      // region inside a fresh one so the flag is visible to the extension.
      return cls.run(async () => {
        cls.set(TENANT_SCOPE_BYPASS_KEY, true);
        return fn();
      });
    }

    const previous = cls.get(TENANT_SCOPE_BYPASS_KEY);
    cls.set(TENANT_SCOPE_BYPASS_KEY, true);
    try {
      return await fn();
    } finally {
      cls.set(TENANT_SCOPE_BYPASS_KEY, previous);
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
