import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async createStudent(dto: CreateStudentDto, actor: AuthContext) {
    const classroom = await this.prisma.class.findFirst({
      where: {
        id: dto.classId,
        tenantId: actor.tenantId,
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    let linkedUserId: string | null = null;

    if (dto.createLogin) {
      const studentRole = await this.prisma.role.findUnique({
        where: {
          tenantId_name: {
            tenantId: actor.tenantId,
            name: 'student',
          },
        },
      });

      if (!studentRole) {
        throw new NotFoundException('Student role not found for this tenant');
      }

      const managedUser = await this.usersService.createManagedUser({
        tenantId: actor.tenantId,
        email: dto.email!,
        password: dto.password!,
        phone: dto.phone,
        roleIds: [studentRole.id],
        assignedById: actor.userId,
      });
      linkedUserId = managedUser.id;
    }

    const student = await this.prisma.student.create({
      data: {
        tenantId: actor.tenantId,
        userId: linkedUserId,
        studentSystemId:
          dto.studentSystemId ?? (await this.generateStudentSystemId(actor)),
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        firstNameNp: dto.firstNameNp ?? null,
        lastNameNp: dto.lastNameNp ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        admissionDate: new Date(dto.admissionDate),
        classId: dto.classId,
        section: dto.section ?? null,
        rollNumber: dto.rollNumber ?? null,
        admissionNumber: dto.admissionNumber ?? null,
        nationality: dto.nationality ?? 'Nepali',
        mediumOfInstruct: dto.mediumOfInstruct ?? 'English',
        emergencyName: dto.emergencyName ?? null,
        emergencyPhone: dto.emergencyPhone ?? null,
      },
      include: {
        class: true,
        user: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        studentSystemId: student.studentSystemId,
        classId: student.classId,
        hasLogin: Boolean(student.userId),
      },
    });

    return {
      id: student.id,
      studentSystemId: student.studentSystemId,
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      class: {
        id: student.class.id,
        name: student.class.name,
      },
      email: student.user?.email ?? null,
      hasLogin: Boolean(student.userId),
    };
  }

  async listStudents(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        user: true,
      },
      orderBy: [{ createdAt: 'desc' }, { firstNameEn: 'asc' }],
    });

    return students.map((student) => ({
      id: student.id,
      studentSystemId: student.studentSystemId,
      firstNameEn: student.firstNameEn,
      lastNameEn: student.lastNameEn,
      class: {
        id: student.class.id,
        name: student.class.name,
      },
      section: student.section,
      rollNumber: student.rollNumber,
      email: student.user?.email ?? null,
      hasLogin: Boolean(student.userId),
    }));
  }

  async generateStudentDocumentPdf(
    studentId: string,
    documentKind: string,
    actor: AuthContext,
  ) {
    const normalizedKind = normalizeStudentDocumentKind(documentKind);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        tenant: true,
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        enrollments: {
          include: {
            academicYear: true,
            section: true,
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const lines = buildStudentDocumentLines(student, normalizedKind);
    const pdf = buildSimplePdf(lines);
    const fileName = `${student.studentSystemId}-${normalizedKind}.pdf`;
    const pdfUrl = `/api/v1/students/${student.id}/documents/${normalizedKind}.pdf`;

    await this.prisma.generatedStudentDocument.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        kind: normalizedKind,
        title: getStudentDocumentTitle(normalizedKind),
        fileName,
        sizeBytes: pdf.byteLength,
        pdfUrl,
        generatedById: actor.userId,
        metadata: {
          studentSystemId: student.studentSystemId,
          className: student.class.name,
          sectionName: student.sectionRef?.name ?? student.section ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditService.record({
      action: 'generate',
      resource: 'student_document_pdf',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: student.id,
      after: {
        kind: normalizedKind,
        fileName,
      },
    });

    return pdf;
  }

  private async generateStudentSystemId(actor: AuthContext) {
    const count = await this.prisma.student.count({
      where: { tenantId: actor.tenantId },
    });

    return `SCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
}

type GeneratedStudentDocumentKind =
  | 'id-card'
  | 'transfer-certificate'
  | 'leaving-certificate'
  | 'character-certificate';

type StudentDocumentPayload = Prisma.StudentGetPayload<{
  include: {
    tenant: true;
    class: true;
    sectionRef: true;
    guardianLinks: {
      include: {
        guardian: true;
      };
    };
    enrollments: {
      include: {
        academicYear: true;
        section: true;
      };
    };
  };
}>;

function normalizeStudentDocumentKind(
  kind: string,
): GeneratedStudentDocumentKind {
  const normalized = kind.toLowerCase().replace(/_/g, '-');

  if (
    normalized === 'id-card' ||
    normalized === 'transfer-certificate' ||
    normalized === 'leaving-certificate' ||
    normalized === 'character-certificate'
  ) {
    return normalized;
  }

  throw new BadRequestException(
    'Document kind must be id-card, transfer-certificate, leaving-certificate, or character-certificate',
  );
}

function getStudentDocumentTitle(kind: GeneratedStudentDocumentKind) {
  switch (kind) {
    case 'id-card':
      return 'Student ID Card';
    case 'transfer-certificate':
      return 'Transfer Certificate';
    case 'leaving-certificate':
      return 'Leaving Certificate';
    case 'character-certificate':
      return 'Character Certificate';
  }
}

function buildStudentDocumentLines(
  student: StudentDocumentPayload,
  kind: GeneratedStudentDocumentKind,
) {
  const latestEnrollment = student.enrollments[0];
  const primaryGuardian =
    student.guardianLinks.find((link) => link.isPrimary)?.guardian ??
    student.guardianLinks[0]?.guardian ??
    null;
  const fullName = `${student.firstNameEn} ${student.lastNameEn}`.trim();
  const sectionName =
    latestEnrollment?.section?.name ??
    student.sectionRef?.name ??
    student.section;
  const baseLines = [
    student.tenant.name,
    getStudentDocumentTitle(kind),
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Student ID: ${student.studentSystemId}`,
    `Name: ${fullName}`,
    `Date of Birth: ${student.dateOfBirth.toISOString().slice(0, 10)}`,
    `Class: ${student.class.name}`,
    `Section: ${sectionName ?? 'N/A'}`,
    `Roll No: ${student.rollNumber ?? latestEnrollment?.rollNumber ?? 'N/A'}`,
    `Guardian: ${primaryGuardian?.fullName ?? 'N/A'}`,
    `Guardian Phone: ${primaryGuardian?.primaryPhone ?? 'N/A'}`,
  ];

  if (kind === 'id-card') {
    return [
      ...baseLines,
      'This card identifies the student as currently enrolled in the school.',
    ];
  }

  if (kind === 'transfer-certificate') {
    return [
      ...baseLines,
      `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
      'The student has been issued this transfer certificate on school request.',
      'Fee and library clearance should be verified before final handover.',
    ];
  }

  if (kind === 'leaving-certificate') {
    return [
      ...baseLines,
      `Admission Date: ${student.admissionDate.toISOString().slice(0, 10)}`,
      'This certifies that the student has completed the leaving process as recorded by the school.',
    ];
  }

  return [
    ...baseLines,
    'This is to certify that the student has maintained good conduct as per available school records.',
    'Issued for official use by the school administration.',
  ];
}
