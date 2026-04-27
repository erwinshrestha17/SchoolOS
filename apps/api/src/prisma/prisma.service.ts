import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';

export const TENANT_ID_KEY = 'tenantId';
type TenantScopedArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const TENANT_SCOPE_EXCLUDED_MODELS = ['Tenant', 'Permission'];
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
) {
  if (!tenantId || TENANT_SCOPE_EXCLUDED_MODELS.includes(model)) {
    return args;
  }

  const scopedArgs = args as TenantScopedArgs;

  if (TENANT_SCOPED_READ_WRITE_OPERATIONS.includes(operation)) {
    scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
  } else if (TENANT_SCOPED_CREATE_OPERATIONS.includes(operation)) {
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
  constructor(private readonly cls: ClsService) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  get client() {
    const cls = this.cls;
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const tenantId = cls?.get(TENANT_ID_KEY);
            return query(
              applyTenantScopeToArgs(model, operation, args, tenantId),
            );
          },
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
