import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';

export const TENANT_ID_KEY = 'tenantId';

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
            // Models that don't have tenantId or shouldn't be scoped automatically
            const excludeModels = ['Tenant', 'Permission'];
            if (excludeModels.includes(model)) {
              return query(args);
            }

            const tenantId = cls?.get(TENANT_ID_KEY);
            if (tenantId) {
              if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
                args.where = { ...args.where, tenantId };
              } else if (['create', 'createMany'].includes(operation)) {
                args.data = Array.isArray(args.data) 
                  ? args.data.map(d => ({ ...d, tenantId }))
                  : { ...args.data, tenantId };
              }
            }
            return query(args);
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
