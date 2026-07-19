import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStreamDto } from './dto/create-stream.dto';

@Injectable()
export class StreamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listStreams(actor: AuthContext) {
    const streams = await this.prisma.stream.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        _count: {
          select: { classes: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return streams.map((stream) => ({
      id: stream.id,
      name: stream.name,
      code: stream.code,
      isActive: stream.isActive,
      classCount: stream._count.classes,
    }));
  }

  async createStream(dto: CreateStreamDto, actor: AuthContext) {
    const existing = await this.prisma.stream.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [{ name: dto.name }, { code: dto.code }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'A stream with this name or code already exists in this tenant',
      );
    }

    const stream = await this.prisma.stream.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        code: dto.code,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'stream',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: stream.id,
      after: {
        name: stream.name,
        code: stream.code,
      },
    });

    return stream;
  }
}
