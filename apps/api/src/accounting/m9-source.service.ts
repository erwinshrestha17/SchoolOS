import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type AnyDb = PrismaService & Record<string, any>;

@Injectable()
export class M9SourceService {
  constructor(private readonly prisma: PrismaService) {}

  listMappings(actor: AuthContext) {
    const db = this.prisma as AnyDb;
    if (!db.accountingSourceMapping) {
      return [];
    }
    return db.accountingSourceMapping.findMany({
      where: { tenantId: actor.tenantId },
    });
  }
}
