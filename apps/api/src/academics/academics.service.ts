import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeLockStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';

@Injectable()
export class AcademicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSubjects(actor: AuthContext) {
    return this.prisma.subject.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: true,
        teacherAssignments: {
          include: {
            staff: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: [{ class: { level: 'asc' } }, { code: 'asc' }],
    });
  }

  async createSubject(dto: CreateSubjectDto, actor: AuthContext) {
    await this.ensureClass(actor, dto.classId);

    const subject = await this.prisma.subject.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        hasPractical: dto.hasPractical ?? false,
        theoryMarks: dto.theoryMarks ?? null,
        practicalMarks:
          dto.practicalMarks === undefined ? null : dto.practicalMarks,
        passMarks: dto.passMarks ?? null,
      },
      include: {
        class: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'subject',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: subject.id,
      after: {
        code: subject.code,
        classId: subject.classId,
      },
    });

    return subject;
  }

  async listTeacherAssignments(actor: AuthContext) {
    return this.prisma.subjectTeacherAssignment.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        subject: true,
        staff: true,
        class: true,
        section: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async assignTeacher(dto: AssignTeacherDto, actor: AuthContext) {
    await Promise.all([
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureClass(actor, dto.classId),
      this.ensureStaff(actor, dto.staffId),
    ]);

    const subject = await this.prisma.subject.findFirst({
      where: {
        id: dto.subjectId,
        tenantId: actor.tenantId,
        classId: dto.classId,
      },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found for this class');
    }

    if (dto.sectionId) {
      await this.ensureSection(actor, dto.sectionId, dto.classId);
    }

    const assignment = await this.prisma.subjectTeacherAssignment.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        subjectId: dto.subjectId,
        staffId: dto.staffId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
      },
      include: {
        academicYear: true,
        subject: true,
        staff: true,
        class: true,
        section: true,
      },
    });

    await this.auditService.record({
      action: 'assign',
      resource: 'teacher_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: {
        subjectId: assignment.subjectId,
        staffId: assignment.staffId,
        classId: assignment.classId,
      },
    });

    return assignment;
  }

  async listExamTerms(actor: AuthContext) {
    return this.prisma.examTerm.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        components: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [{ startsOn: 'desc' }],
    });
  }

  async createExamTerm(dto: CreateExamTermDto, actor: AuthContext) {
    await this.ensureAcademicYear(actor, dto.academicYearId);

    const term = await this.prisma.examTerm.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        weightPercent: new Prisma.Decimal(dto.weightPercent ?? 100),
      },
      include: {
        academicYear: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: term.id,
      after: {
        academicYearId: term.academicYearId,
        name: term.name,
      },
    });

    return term;
  }

  async createAssessmentComponent(
    dto: CreateAssessmentComponentDto,
    actor: AuthContext,
  ) {
    const [term, subject] = await Promise.all([
      this.prisma.examTerm.findFirst({
        where: { id: dto.examTermId, tenantId: actor.tenantId },
      }),
      this.prisma.subject.findFirst({
        where: { id: dto.subjectId, tenantId: actor.tenantId },
      }),
    ]);

    if (!term) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    if (!subject) {
      throw new NotFoundException('Subject not found in this tenant');
    }

    if (term.isLocked) {
      throw new ConflictException('Exam term is locked');
    }

    return this.prisma.assessmentComponent.create({
      data: {
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        subjectId: dto.subjectId,
        name: dto.name,
        type: dto.type,
        maxMarks: new Prisma.Decimal(dto.maxMarks),
        weightPercent: new Prisma.Decimal(dto.weightPercent ?? 100),
        passMarks:
          dto.passMarks === undefined
            ? null
            : new Prisma.Decimal(dto.passMarks),
      },
      include: {
        subject: true,
        examTerm: true,
      },
    });
  }

  async listMarks(actor: AuthContext) {
    return this.prisma.markEntry.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
        examTerm: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  async enterMark(dto: EnterMarkDto, actor: AuthContext) {
    const component = await this.prisma.assessmentComponent.findFirst({
      where: {
        id: dto.assessmentComponentId,
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
      },
      include: {
        examTerm: true,
        subject: true,
      },
    });

    if (!component) {
      throw new NotFoundException('Assessment component not found');
    }

    if (component.examTerm.isLocked) {
      throw new ConflictException('Exam term is locked');
    }

    if (dto.marksObtained > Number(component.maxMarks)) {
      throw new ConflictException('Marks cannot exceed component max marks');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const mark = await this.prisma.markEntry.upsert({
      where: {
        tenantId_assessmentComponentId_studentId: {
          tenantId: actor.tenantId,
          assessmentComponentId: dto.assessmentComponentId,
          studentId: dto.studentId,
        },
      },
      update: {
        marksObtained: new Prisma.Decimal(dto.marksObtained),
        remarks: dto.remarks ?? null,
        enteredById: actor.userId,
      },
      create: {
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        assessmentComponentId: dto.assessmentComponentId,
        subjectId: component.subjectId,
        studentId: dto.studentId,
        enteredById: actor.userId,
        marksObtained: new Prisma.Decimal(dto.marksObtained),
        remarks: dto.remarks ?? null,
      },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
      },
    });

    await this.auditService.record({
      action: 'upsert',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: mark.id,
      after: {
        studentId: mark.studentId,
        componentId: mark.assessmentComponentId,
        marksObtained: Number(mark.marksObtained),
      },
    });

    return mark;
  }

  async listCasRecords(actor: AuthContext) {
    return this.prisma.casRecord.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
      },
      orderBy: [{ observedOn: 'desc' }],
      take: 100,
    });
  }

  async createCasRecord(dto: CreateCasRecordDto, actor: AuthContext) {
    await Promise.all([
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureClass(actor, dto.classId),
      this.ensureSubject(actor, dto.subjectId),
    ]);

    if (dto.sectionId) {
      await this.ensureSection(actor, dto.sectionId, dto.classId);
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this CAS class scope');
    }

    return this.prisma.casRecord.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        subjectId: dto.subjectId,
        studentId: dto.studentId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        category: dto.category,
        score: new Prisma.Decimal(dto.score),
        maxScore: new Prisma.Decimal(dto.maxScore),
        observedOn: new Date(dto.observedOn),
        note: dto.note ?? null,
      },
      include: {
        student: true,
        subject: true,
      },
    });
  }

  async listReportCards(actor: AuthContext) {
    return this.prisma.reportCard.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        examTerm: true,
        student: true,
        class: true,
        section: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  async generateReportCard(dto: GenerateReportCardDto, actor: AuthContext) {
    const [student, examTerm] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
      }),
      this.prisma.examTerm.findFirst({
        where: {
          id: dto.examTermId,
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
        },
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (!examTerm) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    const [marks, casRecords] = await Promise.all([
      this.prisma.markEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
        include: {
          assessmentComponent: true,
          subject: true,
        },
      }),
      this.prisma.casRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          studentId: dto.studentId,
        },
      }),
    ]);

    if (marks.length === 0 && casRecords.length === 0) {
      throw new NotFoundException(
        'No marks or CAS records found for report card',
      );
    }

    const terminal = marks.reduce(
      (acc, mark) => {
        const weight = Number(mark.assessmentComponent.weightPercent) / 100;
        acc.total += Number(mark.marksObtained) * weight;
        acc.max += Number(mark.assessmentComponent.maxMarks) * weight;
        return acc;
      },
      { total: 0, max: 0 },
    );
    const cas = casRecords.reduce(
      (acc, record) => {
        acc.total += Number(record.score);
        acc.max += Number(record.maxScore);
        return acc;
      },
      { total: 0, max: 0 },
    );
    const total = terminal.total + cas.total;
    const max = terminal.max + cas.max;
    const percentage = max > 0 ? (total / max) * 100 : 0;
    const grade = calculateMoestGrade(percentage);

    const reportCard = await this.prisma.reportCard.upsert({
      where: {
        tenantId_academicYearId_examTermId_studentId: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
      },
      update: {
        totalMarks: new Prisma.Decimal(total.toFixed(2)),
        maxMarks: new Prisma.Decimal(max.toFixed(2)),
        percentage: new Prisma.Decimal(percentage.toFixed(2)),
        grade: grade.grade,
        gpa: new Prisma.Decimal(grade.gpa),
        remarks: dto.remarks ?? null,
        status: dto.lock ? GradeLockStatus.LOCKED : GradeLockStatus.DRAFT,
        lockedAt: dto.lock ? new Date() : null,
      },
      create: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        examTermId: dto.examTermId,
        studentId: dto.studentId,
        classId: student.classId,
        sectionId: student.sectionId ?? null,
        totalMarks: new Prisma.Decimal(total.toFixed(2)),
        maxMarks: new Prisma.Decimal(max.toFixed(2)),
        percentage: new Prisma.Decimal(percentage.toFixed(2)),
        grade: grade.grade,
        gpa: new Prisma.Decimal(grade.gpa),
        remarks: dto.remarks ?? null,
        status: dto.lock ? GradeLockStatus.LOCKED : GradeLockStatus.DRAFT,
        lockedAt: dto.lock ? new Date() : null,
      },
      include: {
        student: true,
        examTerm: true,
      },
    });

    if (dto.lock) {
      await this.prisma.markEntry.updateMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
        data: { isLocked: true },
      });
    }

    return reportCard;
  }

  async listPromotionReadiness(
    actor: AuthContext,
    academicYearId?: string,
    classId?: string,
  ) {
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(academicYearId ? { academicYearId } : {}),
        ...(classId ? { classId } : {}),
      },
      include: {
        student: true,
        class: true,
        section: true,
        examTerm: true,
      },
      orderBy: [{ percentage: 'desc' }],
    });

    return reportCards.map((card) => ({
      reportCardId: card.id,
      studentId: card.studentId,
      studentName:
        `${card.student.firstNameEn} ${card.student.lastNameEn}`.trim(),
      className: card.class.name,
      sectionName: card.section?.name ?? null,
      examTerm: card.examTerm.name,
      percentage: Number(card.percentage),
      grade: card.grade,
      status: Number(card.percentage) >= 35 ? 'READY' : 'REVIEW',
      locked: card.status === GradeLockStatus.LOCKED,
    }));
  }

  private async ensureAcademicYear(actor: AuthContext, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!year) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    return year;
  }

  private async ensureClass(actor: AuthContext, id: string) {
    const classroom = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    return classroom;
  }

  private async ensureSection(
    actor: AuthContext,
    id: string,
    classId?: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        ...(classId ? { classId } : {}),
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    return section;
  }

  private async ensureSubject(actor: AuthContext, id: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found in this tenant');
    }

    return subject;
  }

  private async ensureStaff(actor: AuthContext, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    return staff;
  }
}

export function calculateMoestGrade(percentage: number) {
  if (percentage >= 90) {
    return { grade: 'A+', gpa: 4.0 };
  }

  if (percentage >= 80) {
    return { grade: 'A', gpa: 3.6 };
  }

  if (percentage >= 70) {
    return { grade: 'B+', gpa: 3.2 };
  }

  if (percentage >= 60) {
    return { grade: 'B', gpa: 2.8 };
  }

  if (percentage >= 50) {
    return { grade: 'C+', gpa: 2.4 };
  }

  if (percentage >= 40) {
    return { grade: 'C', gpa: 2.0 };
  }

  if (percentage >= 35) {
    return { grade: 'D', gpa: 1.6 };
  }

  return { grade: 'NG', gpa: 0 };
}
