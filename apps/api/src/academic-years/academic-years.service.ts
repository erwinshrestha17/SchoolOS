import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listAcademicYears(actor: AuthContext) {
    return this.prisma.academicYear.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      take: 100,
    });
  }

  async createAcademicYear(dto: CreateAcademicYearDto, actor: AuthContext) {
    const existing = await this.prisma.academicYear.findUnique({
      where: {
        tenantId_name: {
          tenantId: actor.tenantId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Academic year already exists in this tenant',
      );
    }

    if (dto.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { tenantId: actor.tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const academicYear = await this.prisma.academicYear.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        isCurrent: dto.isCurrent ?? false,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'academic_year',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: academicYear.id,
      after: {
        name: academicYear.name,
        startsOn: academicYear.startsOn,
        endsOn: academicYear.endsOn,
        isCurrent: academicYear.isCurrent,
      },
    });

    return academicYear;
  }
}
