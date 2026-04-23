import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listClasses(actor: AuthContext) {
    const classes = await this.prisma.class.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return classes.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      level: classroom.level,
      studentCount: classroom._count.students,
      subjectCount: classroom._count.subjects,
    }));
  }

  async createClass(dto: CreateClassDto, actor: AuthContext) {
    const existingClass = await this.prisma.class.findUnique({
      where: {
        tenantId_name: {
          tenantId: actor.tenantId,
          name: dto.name,
        },
      },
    });

    if (existingClass) {
      throw new ConflictException('Class already exists in this tenant');
    }

    const classroom = await this.prisma.class.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        level: dto.level,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'class',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: classroom.id,
      after: {
        name: classroom.name,
        level: classroom.level,
      },
    });

    return classroom;
  }
}
