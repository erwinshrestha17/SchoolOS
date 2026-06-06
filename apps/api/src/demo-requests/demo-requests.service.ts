import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PaginatedResponse,
  PlatformDemoRequestDetail,
  PlatformDemoRequestSummary,
} from '@schoolos/core';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEMO_REQUEST_STATUSES,
  type DemoRequestStatus,
} from './demo-requests.constants';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';
import { ListDemoRequestsDto } from './dto/list-demo-requests.dto';
import { UpdateDemoRequestStatusDto } from './dto/update-demo-request-status.dto';

@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDemoRequestDto) {
    const request = await this.prisma.demoRequest.create({
      data: {
        schoolName: clean(dto.schoolName),
        schoolType: clean(dto.schoolType),
        location: clean(dto.location),
        studentsCount: clean(dto.studentsCount),
        branchesCount: cleanOptional(dto.branchesCount),
        contactName: clean(dto.contactName),
        role: clean(dto.role),
        phone: clean(dto.phone),
        email: clean(dto.email).toLowerCase(),
        preferredContact: cleanOptional(dto.preferredContact),
        currentSystem: cleanOptional(dto.currentSystem),
        expectedTimeline: clean(dto.expectedTimeline),
        interestedModules: (dto.interestedModules ?? [])
          .map((module) => clean(module))
          .filter(Boolean),
        message: cleanOptional(dto.message),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  async listPage(
    query: ListDemoRequestsDto,
  ): Promise<PaginatedResponse<PlatformDemoRequestSummary>> {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const skip = (page - 1) * limit;
    const where = this.buildListWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.summarySelect(),
      }),
      this.prisma.demoRequest.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSummary(item)),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async getById(id: string): Promise<PlatformDemoRequestDetail> {
    const request = await this.prisma.demoRequest.findUnique({
      where: { id },
      select: {
        ...this.summarySelect(),
        branchesCount: true,
        preferredContact: true,
        currentSystem: true,
        interestedModules: true,
        message: true,
        internalNotes: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Demo request not found');
    }

    return this.toDetail(request);
  }

  async updateStatus(
    id: string,
    dto: UpdateDemoRequestStatusDto,
    userId: string,
  ): Promise<PlatformDemoRequestDetail> {
    const existing = await this.prisma.demoRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        internalNotes: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Demo request not found');
    }

    const nextNotes =
      dto.internalNotes !== undefined
        ? cleanOptional(dto.internalNotes)
        : existing.internalNotes;

    const updated = await this.prisma.demoRequest.update({
      where: { id },
      data: {
        status: dto.status,
        internalNotes: nextNotes,
      },
      select: {
        ...this.summarySelect(),
        branchesCount: true,
        preferredContact: true,
        currentSystem: true,
        interestedModules: true,
        message: true,
        internalNotes: true,
      },
    });

    await this.auditService.record({
      action: 'demo_request_status_updated',
      resource: 'demo_request',
      resourceId: id,
      tenantId: 'platform',
      userId,
      before: {
        status: existing.status,
        internalNotes: existing.internalNotes,
      },
      after: {
        status: updated.status,
        internalNotes: updated.internalNotes,
      },
    });

    return this.toDetail(updated);
  }

  private buildListWhere(
    query: ListDemoRequestsDto,
  ): Prisma.DemoRequestWhereInput {
    const where: Prisma.DemoRequestWhereInput = {};

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { schoolName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    return where;
  }

  private summarySelect() {
    return {
      id: true,
      schoolName: true,
      schoolType: true,
      location: true,
      studentsCount: true,
      contactName: true,
      role: true,
      phone: true,
      email: true,
      expectedTimeline: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toSummary(
    request: Prisma.DemoRequestGetPayload<{
      select: ReturnType<DemoRequestsService['summarySelect']>;
    }>,
  ): PlatformDemoRequestSummary {
    return {
      id: request.id,
      schoolName: request.schoolName,
      schoolType: request.schoolType,
      location: request.location,
      studentsCount: request.studentsCount,
      contactName: request.contactName,
      role: request.role,
      phone: request.phone,
      email: request.email,
      expectedTimeline: request.expectedTimeline,
      status: this.toStatus(request.status),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private toDetail(
    request: Prisma.DemoRequestGetPayload<{
      select: ReturnType<DemoRequestsService['summarySelect']> & {
        branchesCount: true;
        preferredContact: true;
        currentSystem: true;
        interestedModules: true;
        message: true;
        internalNotes: true;
      };
    }>,
  ): PlatformDemoRequestDetail {
    return {
      ...this.toSummary(request),
      branchesCount: request.branchesCount,
      preferredContact: request.preferredContact,
      currentSystem: request.currentSystem,
      interestedModules: request.interestedModules,
      message: request.message,
      internalNotes: request.internalNotes,
    };
  }

  private toStatus(status: string): DemoRequestStatus {
    if ((DEMO_REQUEST_STATUSES as readonly string[]).includes(status)) {
      return status as DemoRequestStatus;
    }
    return 'NEW';
  }
}

function clean(value: string) {
  return value.trim();
}

function cleanOptional(value?: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    return null;
  }
  return cleaned;
}
