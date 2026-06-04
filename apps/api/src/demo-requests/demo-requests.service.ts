import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
