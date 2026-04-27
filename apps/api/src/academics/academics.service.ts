import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AudienceType,
  ConsentType,
  GradeLockStatus,
  HomeworkStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateExamTimetableSlotDto } from './dto/create-exam-timetable-slot.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { RequestMarkLockDto } from './dto/request-mark-lock.dto';
import { ReviewMarkLockDto } from './dto/review-mark-lock.dto';

@Injectable()
export class AcademicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
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

  async listExamTimetable(actor: AuthContext) {
    return this.prisma.examTimetableSlot.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        examTerm: true,
        subject: true,
        class: true,
        section: true,
      },
      orderBy: [{ startsAt: 'asc' }],
    });
  }

  async createExamTimetableSlot(
    dto: CreateExamTimetableSlotDto,
    actor: AuthContext,
  ) {
    await Promise.all([
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureClass(actor, dto.classId),
      this.ensureSubject(actor, dto.subjectId),
    ]);

    const term = await this.prisma.examTerm.findFirst({
      where: {
        id: dto.examTermId,
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
      },
    });

    if (!term) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    if (dto.sectionId) {
      await this.ensureSection(actor, dto.sectionId, dto.classId);
    }

    const slot = await this.prisma.examTimetableSlot.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        examTermId: dto.examTermId,
        subjectId: dto.subjectId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        room: dto.room ?? null,
      },
      include: {
        subject: true,
        class: true,
        section: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'exam_timetable_slot',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: slot.id,
      after: {
        examTermId: slot.examTermId,
        subjectId: slot.subjectId,
        startsAt: slot.startsAt,
      },
    });

    return slot;
  }

  async publishExamTimetable(examTermId: string, actor: AuthContext) {
    const slots = await this.prisma.examTimetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId,
      },
      include: {
        subject: true,
        class: true,
        section: true,
      },
    });

    if (slots.length === 0) {
      throw new NotFoundException('No exam timetable slots found to publish');
    }

    await this.prisma.examTimetableSlot.updateMany({
      where: { tenantId: actor.tenantId, examTermId },
      data: { publishedAt: new Date() },
    });

    for (const slot of slots) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'exam_timetable',
        sourceId: slot.id,
        audienceType: slot.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        classId: slot.classId,
        sectionId: slot.sectionId,
        title: 'Exam timetable published',
        body: `${slot.subject.name} exam starts at ${slot.startsAt.toISOString()}.`,
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    await this.auditService.record({
      action: 'publish',
      resource: 'exam_timetable',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: examTermId,
      after: { slotCount: slots.length },
    });

    this.eventEmitter.emit('exam.published', {
      tenantId: actor.tenantId,
      classId: slots[0].classId,
      examTermId,
      actor,
    });

    return { examTermId, publishedSlots: slots.length };
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

  async listMarkLockRequests(actor: AuthContext) {
    return this.prisma.markLockRequest.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        examTerm: true,
        requestedBy: true,
        reviewedBy: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async requestMarkLock(dto: RequestMarkLockDto, actor: AuthContext) {
    const term = await this.prisma.examTerm.findFirst({
      where: { id: dto.examTermId, tenantId: actor.tenantId },
    });

    if (!term) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    const request = await this.prisma.markLockRequest.create({
      data: {
        tenantId: actor.tenantId,
        examTermId: term.id,
        requestedById: actor.userId,
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      action: 'request',
      resource: 'mark_lock',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: { examTermId: term.id },
    });

    return request;
  }

  async reviewMarkLockRequest(
    requestId: string,
    dto: ReviewMarkLockDto,
    actor: AuthContext,
  ) {
    const request = await this.prisma.markLockRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
    });

    if (!request) {
      throw new NotFoundException('Mark lock request not found');
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.markLockRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote ?? null,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === 'APPROVED') {
        await tx.examTerm.update({
          where: { id: request.examTermId },
          data: { isLocked: true },
        });
        await tx.markEntry.updateMany({
          where: {
            tenantId: actor.tenantId,
            examTermId: request.examTermId,
          },
          data: { isLocked: true },
        });
      }

      return updated;
    });

    await this.auditService.record({
      action: 'review',
      resource: 'mark_lock',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reviewed.id,
      after: {
        status: reviewed.status,
        examTermId: reviewed.examTermId,
      },
    });

    return reviewed;
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

  async getReportCardPdf(reportCardId: string, actor: AuthContext) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId: actor.tenantId,
      },
      include: {
        student: true,
        class: true,
        section: true,
        examTerm: true,
      },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    const unpaid = await this.prisma.invoice.count({
      where: {
        tenantId: actor.tenantId,
        studentId: reportCard.studentId,
        reportCardBlocked: true,
        status: { in: ['ISSUED', 'PARTIAL'] },
      },
    });

    if (unpaid > 0) {
      throw new ConflictException('Report card is blocked by unpaid fees');
    }

    return buildSimplePdf([
      'SchoolOS Report Card',
      `Exam: ${reportCard.examTerm.name}`,
      `Student: ${reportCard.student.firstNameEn} ${reportCard.student.lastNameEn}`,
      `Class: ${reportCard.class.name}`,
      `Section: ${reportCard.section?.name ?? 'N/A'}`,
      `Percentage: ${Number(reportCard.percentage).toFixed(2)}%`,
      `Grade: ${reportCard.grade}`,
      `GPA: ${Number(reportCard.gpa).toFixed(2)}`,
      `Status: ${reportCard.status}`,
      `Remarks: ${reportCard.remarks ?? 'N/A'}`,
      'SEE-format metadata: tenant-scoped school record, marks locked before issue where applicable.',
    ]);
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

    await this.auditService.record({
      action: 'generate',
      resource: 'report_card',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reportCard.id,
      after: {
        percentage: Number(reportCard.percentage),
        grade: reportCard.grade,
        status: reportCard.status,
      },
    });

    return reportCard;
  }

  async createSyllabusTopic(
    subjectId: string,
    dto: { title: string; description?: string; orderIndex?: number },
    actor: AuthContext,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const topic = await this.prisma.syllabusTopic.create({
      data: {
        tenantId: actor.tenantId,
        subjectId,
        title: dto.title,
        description: dto.description ?? null,
        orderIndex: dto.orderIndex ?? 0,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'syllabus_topic',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: topic.id,
      after: { title: topic.title, subjectId },
    });

    return topic;
  }

  async listSyllabusTopics(subjectId: string, actor: AuthContext) {
    return this.prisma.syllabusTopic.findMany({
      where: { tenantId: actor.tenantId, subjectId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async markTopicComplete(topicId: string, actor: AuthContext) {
    const topic = await this.prisma.syllabusTopic.findFirst({
      where: { id: topicId, tenantId: actor.tenantId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const updated = await this.prisma.syllabusTopic.update({
      where: { id: topicId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        completedByStaffId: (await this.getStaffId(actor)) ?? null,
      },
    });

    await this.auditService.record({
      action: 'complete',
      resource: 'syllabus_topic',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: topic.id,
    });

    return updated;
  }

  async getSyllabusProgress(subjectId: string, actor: AuthContext) {
    const topics = await this.prisma.syllabusTopic.findMany({
      where: { tenantId: actor.tenantId, subjectId },
    });

    const total = topics.length;
    if (total === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    const completed = topics.filter((t) => t.isCompleted).length;
    return {
      total,
      completed,
      percentage: Math.round((completed / total) * 10000) / 100,
    };
  }

  private async getStaffId(actor: AuthContext): Promise<string | null> {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });
    return staff?.id ?? null;
  }

  async createHomework(
    dto: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
      title: string;
      instructions: string;
      dueAt: string;
      maxScore?: number;
    },
    actor: AuthContext,
  ) {
    const staffId = await this.getStaffId(actor);

    // Subject-Teacher Scoping
    if (actor.roles.includes('subject_teacher') && !actor.roles.includes('super_admin') && !actor.roles.includes('admin')) {
      const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId: actor.tenantId,
          subjectId: dto.subjectId,
          staffId: staffId!,
        },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this subject');
      }
    }

    const homework = await this.prisma.homeworkAssignment.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        assignedByStaffId: staffId,
        title: dto.title,
        instructions: dto.instructions,
        dueAt: new Date(dto.dueAt),
        maxScore: dto.maxScore ? new Prisma.Decimal(dto.maxScore) : null,
      },
    });

    // Fire automated system post via ActivityFeedService listening to this event
    this.eventEmitter.emit('homework.assigned', {
      tenantId: actor.tenantId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      homeworkId: homework.id,
      title: homework.title,
      actor,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'homework',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: homework.id,
    });

    return homework;
  }

  async listHomeworks(actor: AuthContext, classId?: string, subjectId?: string) {
    return this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(classId ? { classId } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        subject: true,
        assignedByStaff: true,
      },
      orderBy: [{ dueAt: 'desc' }],
    });
  }

  async listHomeworkSubmissions(homeworkId: string, actor: AuthContext) {
    return this.prisma.homeworkSubmission.findMany({
      where: { tenantId: actor.tenantId, homeworkId },
      include: { student: true },
    });
  }

  async reviewHomeworkSubmission(
    submissionId: string,
    dto: { status: HomeworkStatus; score?: number; feedback?: string },
    actor: AuthContext,
  ) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { id: submissionId, tenantId: actor.tenantId },
      include: { homework: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (actor.roles.includes('subject_teacher') && !actor.roles.includes('super_admin') && !actor.roles.includes('admin')) {
      const staffId = await this.getStaffId(actor);
      const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
        where: {
          tenantId: actor.tenantId,
          subjectId: submission.homework.subjectId,
          staffId: staffId!,
        },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this subject');
      }
    }

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        status: dto.status,
        score: dto.score ? new Prisma.Decimal(dto.score) : null,
        feedback: dto.feedback ?? null,
      },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'homework_submission',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: updated.status, score: dto.score },
    });

    return updated;
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
      status: getPromotionStatus(Number(card.percentage)),
      locked: card.status === GradeLockStatus.LOCKED,
    }));
  }

  async listRemedialStudents(actor: AuthContext, academicYearId?: string) {
    const cards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(academicYearId ? { academicYearId } : {}),
        OR: [{ grade: 'NG' }, { percentage: { lt: new Prisma.Decimal(35) } }],
      },
      include: {
        student: true,
        class: true,
        section: true,
        examTerm: true,
      },
      orderBy: [{ percentage: 'asc' }],
    });

    return cards.map((card) => ({
      reportCardId: card.id,
      studentId: card.studentId,
      studentName:
        `${card.student.firstNameEn} ${card.student.lastNameEn}`.trim(),
      className: card.class.name,
      sectionName: card.section?.name ?? null,
      examTerm: card.examTerm.name,
      percentage: Number(card.percentage),
      grade: card.grade,
      reason: card.grade === 'NG' ? 'NG outcome' : 'Below 35%',
    }));
  }

  async promoteStudent(dto: PromoteStudentDto, actor: AuthContext) {
    const [student, sourceYear, targetYear] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
      }),
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureAcademicYear(actor, dto.targetAcademicYearId),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    await this.ensureClass(actor, dto.toClassId);

    if (sourceYear.id === targetYear.id) {
      throw new ConflictException('Target academic year must be different');
    }

    if (dto.toSectionId) {
      await this.ensureSection(actor, dto.toSectionId, dto.toClassId);
    }

    const lockedReportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        studentId: dto.studentId,
        status: GradeLockStatus.LOCKED,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (lockedReportCards.length === 0) {
      throw new ConflictException(
        'At least one locked report card is required before promotion',
      );
    }

    const averagePercentage =
      lockedReportCards.reduce(
        (sum, card) => sum + Number(card.percentage),
        0,
      ) / lockedReportCards.length;

    if (getPromotionStatus(averagePercentage) !== 'READY') {
      throw new ConflictException(
        'Student requires academic review before promotion',
      );
    }

    const promotion = await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          studentId: dto.studentId,
          status: 'ACTIVE',
        },
        data: { status: 'PROMOTED' },
      });

      const targetEnrollment = await tx.enrollment.upsert({
        where: {
          tenantId_studentId_academicYearId: {
            tenantId: actor.tenantId,
            studentId: dto.studentId,
            academicYearId: dto.targetAcademicYearId,
          },
        },
        update: {
          classId: dto.toClassId,
          sectionId: dto.toSectionId ?? null,
          status: 'ACTIVE',
        },
        create: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          academicYearId: dto.targetAcademicYearId,
          classId: dto.toClassId,
          sectionId: dto.toSectionId ?? null,
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
          admissionDate: new Date(),
          mediumOfInstruction: student.mediumOfInstruct,
          status: 'ACTIVE',
        },
      });

      await tx.student.update({
        where: { id: student.id },
        data: {
          classId: dto.toClassId,
          sectionId: dto.toSectionId ?? null,
          section: null,
        },
      });

      const createdPromotion = await tx.promotionRecord.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          studentId: dto.studentId,
          fromClassId: student.classId,
          fromSectionId: student.sectionId ?? null,
          toClassId: dto.toClassId,
          toSectionId: dto.toSectionId ?? null,
          status: 'PROMOTED',
          remarks: dto.remarks ?? null,
        },
        include: {
          student: true,
          fromClass: true,
          fromSection: true,
          toClass: true,
          toSection: true,
        },
      });

      return {
        promotion: createdPromotion,
        targetEnrollment,
      };
    });

    await this.auditService.record({
      action: 'promote',
      resource: 'promotion_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: promotion.promotion.id,
      after: {
        studentId: dto.studentId,
        fromAcademicYearId: dto.academicYearId,
        targetAcademicYearId: dto.targetAcademicYearId,
        toClassId: dto.toClassId,
        averagePercentage,
      },
    });

    return promotion;
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

export function getPromotionStatus(percentage: number) {
  return percentage >= 35 ? 'READY' : 'REVIEW';
}
