import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { NEPAL_SCHOOL_CHART_TEMPLATE } from './m9-accounting.utils';

@Injectable()
export class M9TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async importNepalChartTemplate(actor: AuthContext) {
    const accounts = await Promise.all(
      NEPAL_SCHOOL_CHART_TEMPLATE.map((account) =>
        this.prisma.chartAccount.upsert({
          where: {
            tenantId_code: { tenantId: actor.tenantId, code: account.code },
          },
          update: {
            name: account.name,
            type: account.type,
            isSystem: true,
            isActive: true,
            archivedAt: null,
          },
          create: {
            tenantId: actor.tenantId,
            code: account.code,
            name: account.name,
            type: account.type,
            isSystem: true,
          },
        }),
      ),
    );

    await this.auditService.record({
      action: 'import_chart_template',
      resource: 'accounting_chart_template',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: actor.tenantId,
      after: {
        template: 'STANDARD_SCHOOL_CHART',
        accountCount: accounts.length,
      },
    });

    return {
      template: 'NEPAL_SCHOOL_STANDARD',
      count: accounts.length,
      accounts,
    };
  }
}
