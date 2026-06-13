import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class M9TestService {
  constructor(private readonly prisma: PrismaService) {}

  writeSample() {
    return this.prisma.chartAccount.upsert({
      where: { tenantId_code: { tenantId: 'tenant', code: '1000' } },
      update: { name: 'Cash' },
      create: { tenantId: 'tenant', code: '1000', name: 'Cash', type: 'ASSET' as any },
    });
  }
}
