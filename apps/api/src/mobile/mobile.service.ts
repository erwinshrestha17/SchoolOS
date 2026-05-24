import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Student } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
} from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';

interface MobileStudentRow extends Student {
  class: { id: string; name: string };
  sectionRef: { id: string; name: string } | null;
  guardianLinks: Array<{
    relation: string;
    isPrimary: boolean;
    guardian: {
      userId: string | null;
    };
  }>;
  enrollments: Array<{
    academicYear: {
      name: string;
    };
  }>;
}

@Injectable()
export class MobileService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyStudents(actor: AuthContext) {
    const studentIds = await this.getAllowedStudentIds(actor);

    if (studentIds.length === 0) {
      return { items: [] };
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: studentIds },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        sectionRef: {
          select: {
            id: true,
            name: true,
          },
        },
        guardianLinks: {
          where: {
            guardian: {
              userId: actor.userId,
            },
          },
          include: {
            guardian: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        enrollments: {
          include: {
            academicYear: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
    });

    return {
      items: students.map((student) => toMobileStudent(student)),
    };
  }

  private async getAllowedStudentIds(actor: AuthContext) {
    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null) {
      return parentStudentIds;
    }

    const ownStudentId = await getStudentOwnId(this.prisma, actor);
    if (ownStudentId) {
      return [ownStudentId];
    }

    throw new ForbiddenException('Mobile student scope is not available');
  }
}

function toMobileStudent(student: MobileStudentRow) {
  const guardianLink = student.guardianLinks[0];
  const sectionName = student.sectionRef?.name ?? student.section ?? null;

  return {
    id: student.id,
    name: [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' '),
    classSection: [student.class.name, sectionName].filter(Boolean).join(' - '),
    classId: student.class.id,
    sectionId: student.sectionId,
    rollNumber: student.rollNumber?.toString() ?? '',
    academicYear: student.enrollments[0]?.academicYear.name ?? '',
    relationship: guardianLink?.relation ?? 'Self',
  };
}
