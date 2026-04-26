import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRecordsService } from '../student-records/student-records.service';
import { UsersService } from '../users/users.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly financeService: FinanceService,
    private readonly studentRecordsService: StudentRecordsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async listAdmissions(actor: AuthContext) {
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
        },
        enrollments: {
          include: {
            academicYear: true,
            section: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { issuedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return students.map((student) => ({
      id: student.id,
      studentSystemId: student.studentSystemId,
      fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      fullNameNp:
        student.firstNameNp || student.lastNameNp
          ? `${student.firstNameNp ?? ''} ${student.lastNameNp ?? ''}`.trim()
          : null,
      className: student.class.name,
      sectionName: student.sectionRef?.name ?? student.section ?? null,
      rollNumber: student.rollNumber,
      documentCount: student._count.documents,
      guardians: student.guardianLinks.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relation: link.relation,
        primaryPhone: link.guardian.primaryPhone,
        isPrimary: link.isPrimary,
      })),
      latestEnrollment: student.enrollments[0]
        ? {
            id: student.enrollments[0].id,
            academicYear: student.enrollments[0].academicYear.name,
            status: student.enrollments[0].status,
          }
        : null,
      latestInvoice: student.invoices[0]
        ? {
            id: student.invoices[0].id,
            invoiceNumber: student.invoices[0].invoiceNumber,
            status: student.invoices[0].status,
            totalAmount: Number(student.invoices[0].totalAmount),
          }
        : null,
    }));
  }

  async createAdmission(dto: CreateAdmissionDto, actor: AuthContext) {
    const [academicYear, classroom, section] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found in this tenant');
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
          dto.studentSystemId ??
          (await this.generateStudentSystemId(actor, academicYear.startsOn)),
        firstNameEn: dto.firstNameEn,
        lastNameEn: dto.lastNameEn,
        firstNameNp: dto.firstNameNp ?? null,
        lastNameNp: dto.lastNameNp ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        admissionDate: new Date(dto.admissionDate),
        admissionNumber: dto.admissionNumber ?? null,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        section: section?.name ?? null,
        rollNumber: dto.rollNumber ?? null,
        nationality: dto.nationality ?? 'Nepali',
        motherTongue: dto.motherTongue ?? null,
        disabilityFlag: dto.disabilityFlag ?? null,
        mediumOfInstruct: dto.mediumOfInstruction ?? 'English',
        emergencyName: dto.emergencyName ?? null,
        emergencyPhone: dto.emergencyPhone ?? null,
        medicalConditions: dto.medicalConditions ?? null,
        specialNeeds: dto.specialNeeds ?? null,
        privacyConsentAt: new Date(),
        dataProcessingConsentedAt: new Date(),
      },
    });

    const guardianLinks: Array<{
      relation: string;
      guardian: {
        id: string;
        fullName: string;
      };
    }> = [];

    for (const guardianInput of dto.guardians) {
      const guardian = await this.prisma.guardian.upsert({
        where: {
          tenantId_primaryPhone: {
            tenantId: actor.tenantId,
            primaryPhone: guardianInput.primaryPhone,
          },
        },
        update: {
          fullName: guardianInput.fullName,
          relation: guardianInput.relation,
          secondaryPhone: guardianInput.secondaryPhone ?? null,
          email: guardianInput.email ?? null,
          occupation: guardianInput.occupation ?? null,
          homeAddress: guardianInput.homeAddress ?? null,
          wardNumber: guardianInput.wardNumber ?? null,
          receivesAlerts: guardianInput.receivesAlerts ?? false,
          privacyConsentAt: new Date(),
        },
        create: {
          tenantId: actor.tenantId,
          fullName: guardianInput.fullName,
          relation: guardianInput.relation,
          primaryPhone: guardianInput.primaryPhone,
          secondaryPhone: guardianInput.secondaryPhone ?? null,
          email: guardianInput.email ?? null,
          occupation: guardianInput.occupation ?? null,
          homeAddress: guardianInput.homeAddress ?? null,
          wardNumber: guardianInput.wardNumber ?? null,
          receivesAlerts: guardianInput.receivesAlerts ?? false,
          privacyConsentAt: new Date(),
        },
      });

      guardianLinks.push(
        await this.prisma.studentGuardian.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: guardianInput.relation,
            isPrimary: guardianInput.isPrimary ?? false,
          },
          include: {
            guardian: true,
          },
        }),
      );

      if (guardian.email) {
        await this.notificationsService.sendEmail({
          to: guardian.email,
          subject: `${actor.tenantSlug}: admission invitation`,
          text: `${student.firstNameEn} ${student.lastNameEn} has been enrolled in ${classroom.name}.`,
          metadata: {
            purpose: 'guardian_invite',
            studentId: student.id,
          },
        });
      }
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        rollNumber: dto.rollNumber ?? null,
        admissionNumber: dto.admissionNumber ?? null,
        admissionDate: new Date(dto.admissionDate),
        mediumOfInstruction: dto.mediumOfInstruction ?? 'English',
      },
    });

    await this.financeService.assignFeePlansForEnrollment({
      tenantId: actor.tenantId,
      studentId: student.id,
      academicYearId: dto.academicYearId,
      classId: dto.classId,
    });

    const initialInvoice = await this.financeService.createInitialInvoice({
      actor,
      studentId: student.id,
      academicYearId: dto.academicYearId,
      enrollmentId: enrollment.id,
      dueDate: new Date(dto.admissionDate),
    });

    const documents: Array<
      Awaited<ReturnType<StudentRecordsService['uploadDocument']>>
    > = [];

    for (const documentInput of dto.documents ?? []) {
      documents.push(
        await this.studentRecordsService.uploadDocument(
          {
            ...documentInput,
            studentId: student.id,
          },
          actor,
        ),
      );
    }

    await this.auditService.record({
      action: 'create',
      resource: 'admission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: enrollment.id,
      after: {
        studentId: student.id,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        guardianCount: guardianLinks.length,
        invoiceId: initialInvoice?.id ?? null,
      },
    });

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        fullNameEn: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      },
      enrollment: {
        id: enrollment.id,
        academicYearId: enrollment.academicYearId,
        classId: enrollment.classId,
        sectionId: enrollment.sectionId,
        rollNumber: enrollment.rollNumber,
      },
      guardians: guardianLinks.map((link) => ({
        id: link.guardian.id,
        fullName: link.guardian.fullName,
        relation: link.relation,
      })),
      documents,
      invoice: initialInvoice
        ? {
            id: initialInvoice.id,
            invoiceNumber: initialInvoice.invoiceNumber,
            totalAmount: Number(initialInvoice.totalAmount),
          }
        : null,
    };
  }

  private async generateStudentSystemId(actor: AuthContext, startsOn: Date) {
    const count = await this.prisma.student.count({
      where: { tenantId: actor.tenantId },
    });

    return `SCH-${startsOn.getUTCFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
}
