import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type CaseMetadata = {
  followUps?: Array<{ code: string; label: string; blocking: boolean }>;
};

@Injectable()
export class AdmissionCaseFollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForStudent(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    const admissionCase = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId: actor.tenantId,
        convertedStudentId: studentId,
        status: 'ADMITTED',
      },
      select: { id: true, duplicateReview: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const metadata = this.metadata(admissionCase?.duplicateReview ?? null);
    return {
      admissionCaseId: admissionCase?.id ?? null,
      updatedAt: admissionCase?.updatedAt.toISOString() ?? null,
      items: metadata.followUps ?? [],
    };
  }

  private metadata(value: Prisma.JsonValue | null): CaseMetadata {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as CaseMetadata)
      : {};
  }
}
