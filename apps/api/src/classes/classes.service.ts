import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  educationProgramForClassLevel,
  HIGHER_SECONDARY_MIN_CLASS_LEVEL,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignClassStreamDto } from './dto/assign-class-stream.dto';
import { CreateClassDto } from './dto/create-class.dto';

// Streams (Science, Management, ...) are a Higher Secondary / +2 concept.
// This matches the existing Grade 11-12 threshold used for admission grade
// banding in admission-cases.service.ts's gradeBand().
const HIGHER_SECONDARY_MIN_LEVEL = HIGHER_SECONDARY_MIN_CLASS_LEVEL;

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
        stream: true,
        _count: {
          select: {
            students: true,
            subjects: true,
            sections: true,
          },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return classes.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      level: classroom.level,
      program: educationProgramForClassLevel(classroom.level),
      studentCount: classroom._count.students,
      subjectCount: classroom._count.subjects,
      sectionCount: classroom._count.sections,
      streamId: classroom.streamId,
      streamName: classroom.stream?.name ?? null,
    }));
  }

  async assignClassStream(
    classId: string,
    dto: AssignClassStreamDto,
    actor: AuthContext,
  ) {
    const classroom = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
    });
    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    const streamId = dto.streamId ?? null;

    if (streamId !== null) {
      if (classroom.level < HIGHER_SECONDARY_MIN_LEVEL) {
        throw new UnprocessableEntityException(
          `Streams apply to Higher Secondary classes (level ${HIGHER_SECONDARY_MIN_LEVEL} and above) only.`,
        );
      }

      const stream = await this.prisma.stream.findFirst({
        where: { id: streamId, tenantId: actor.tenantId },
      });
      if (!stream) {
        throw new NotFoundException('Stream not found in this tenant');
      }
    }

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: { streamId },
      include: { stream: true },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'class',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: classId,
      before: { streamId: classroom.streamId },
      after: { streamId },
    });

    return {
      id: updated.id,
      name: updated.name,
      level: updated.level,
      program: educationProgramForClassLevel(updated.level),
      streamId: updated.streamId,
      streamName: updated.stream?.name ?? null,
    };
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

    return {
      id: classroom.id,
      name: classroom.name,
      level: classroom.level,
      program: educationProgramForClassLevel(classroom.level),
      streamId: classroom.streamId,
      streamName: null,
    };
  }
}
