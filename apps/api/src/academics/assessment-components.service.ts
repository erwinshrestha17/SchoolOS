import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { UpdateAssessmentComponentDto } from './dto/update-assessment-component.dto';

@Injectable()
export class AssessmentComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listByExamTerm(
    actor: AuthContext,
    examTermId: string,
    subjectId?: string,
  ) {
    await this.ensureExamTerm(actor, examTermId);

    if (subjectId) {
      await this.ensureSubject(actor, subjectId);
    }

    return this.prisma.assessmentComponent.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId,
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        subject: {
          include: {
            class: true,
          },
        },
        examTerm: true,
      },
      orderBy: [{ subject: { code: 'asc' } }, { name: 'asc' }],
    });
  }

  async create(dto: CreateAssessmentComponentDto, actor: AuthContext) {
    const [term, subject] = await Promise.all([
      this.ensureExamTerm(actor, dto.examTermId),
      this.ensureSubject(actor, dto.subjectId),
    ]);

    this.ensureUnlockedTerm(term.isLocked);
    this.validateMarks(dto.maxMarks, dto.passMarks);

    const weightPercent = new Prisma.Decimal(dto.weightPercent ?? 100);
    await this.ensureWeightLimit(
      actor,
      dto.examTermId,
      dto.subjectId,
      weightPercent,
    );

    const component = await this.prisma.assessmentComponent.create({
      data: {
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        subjectId: dto.subjectId,
        name: dto.name.trim(),
        type: dto.type,
        maxMarks: new Prisma.Decimal(dto.maxMarks),
        weightPercent,
        passMarks:
          dto.passMarks === undefined
            ? null
            : new Prisma.Decimal(dto.passMarks),
      },
      include: {
        subject: {
          include: { class: true },
        },
        examTerm: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'assessment_component',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: component.id,
      after: {
        examTermId: component.examTermId,
        subjectId: component.subjectId,
        name: component.name,
        type: component.type,
        maxMarks: Number(component.maxMarks),
        passMarks:
          component.passMarks === null ? null : Number(component.passMarks),
        weightPercent: Number(component.weightPercent),
      },
    });

    return component;
  }

  async update(
    assessmentComponentId: string,
    dto: UpdateAssessmentComponentDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.assessmentComponent.findFirst({
      where: { id: assessmentComponentId, tenantId: actor.tenantId },
      include: { examTerm: true },
    });

    if (!existing) {
      throw new NotFoundException(
        'Assessment component not found in this tenant',
      );
    }

    this.ensureUnlockedTerm(existing.examTerm.isLocked);

    const examTermId = dto.examTermId ?? existing.examTermId;
    const subjectId = dto.subjectId ?? existing.subjectId;
    const [term] = await Promise.all([
      this.ensureExamTerm(actor, examTermId),
      this.ensureSubject(actor, subjectId),
    ]);
    this.ensureUnlockedTerm(term.isLocked);

    const maxMarks = dto.maxMarks ?? Number(existing.maxMarks);
    const passMarks =
      dto.passMarks === undefined
        ? existing.passMarks === null
          ? undefined
          : Number(existing.passMarks)
        : dto.passMarks;
    this.validateMarks(maxMarks, passMarks);

    const weightPercent =
      dto.weightPercent === undefined
        ? existing.weightPercent
        : new Prisma.Decimal(dto.weightPercent);
    await this.ensureWeightLimit(
      actor,
      examTermId,
      subjectId,
      weightPercent,
      assessmentComponentId,
    );

    const updated = await this.prisma.assessmentComponent.update({
      where: { id: existing.id },
      data: {
        examTermId,
        subjectId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        maxMarks: new Prisma.Decimal(maxMarks),
        weightPercent,
        passMarks:
          passMarks === undefined ? null : new Prisma.Decimal(passMarks),
      },
      include: {
        subject: {
          include: { class: true },
        },
        examTerm: true,
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'assessment_component',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        examTermId: existing.examTermId,
        subjectId: existing.subjectId,
        name: existing.name,
        type: existing.type,
        maxMarks: Number(existing.maxMarks),
        passMarks:
          existing.passMarks === null ? null : Number(existing.passMarks),
        weightPercent: Number(existing.weightPercent),
      },
      after: {
        examTermId: updated.examTermId,
        subjectId: updated.subjectId,
        name: updated.name,
        type: updated.type,
        maxMarks: Number(updated.maxMarks),
        passMarks:
          updated.passMarks === null ? null : Number(updated.passMarks),
        weightPercent: Number(updated.weightPercent),
      },
    });

    return updated;
  }

  async delete(assessmentComponentId: string, actor: AuthContext) {
    const existing = await this.prisma.assessmentComponent.findFirst({
      where: { id: assessmentComponentId, tenantId: actor.tenantId },
      include: { examTerm: true },
    });

    if (!existing) {
      throw new NotFoundException(
        'Assessment component not found in this tenant',
      );
    }

    this.ensureUnlockedTerm(existing.examTerm.isLocked);

    const markCount = await this.prisma.markEntry.count({
      where: {
        tenantId: actor.tenantId,
        assessmentComponentId,
      },
    });

    if (markCount > 0) {
      throw new ConflictException(
        'Assessment component has mark entries and cannot be deleted',
      );
    }

    await this.prisma.assessmentComponent.delete({
      where: { id: existing.id },
    });

    await this.auditService.record({
      action: 'delete',
      resource: 'assessment_component',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: existing.id,
      before: {
        examTermId: existing.examTermId,
        subjectId: existing.subjectId,
        name: existing.name,
        type: existing.type,
        maxMarks: Number(existing.maxMarks),
        passMarks:
          existing.passMarks === null ? null : Number(existing.passMarks),
        weightPercent: Number(existing.weightPercent),
      },
    });

    return { deleted: true, assessmentComponentId };
  }

  private async ensureExamTerm(actor: AuthContext, examTermId: string) {
    const term = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
    });

    if (!term) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    return term;
  }

  private async ensureSubject(actor: AuthContext, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
      include: { class: true },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found in this tenant');
    }

    if (subject.class.tenantId !== actor.tenantId) {
      throw new NotFoundException('Subject class not found in this tenant');
    }

    return subject;
  }

  private ensureUnlockedTerm(isLocked: boolean) {
    if (isLocked) {
      throw new ConflictException('Locked exam terms cannot be modified');
    }
  }

  private validateMarks(maxMarks: number, passMarks?: number) {
    if (maxMarks <= 0) {
      throw new ConflictException('maxMarks must be positive');
    }

    if (passMarks !== undefined && passMarks > maxMarks) {
      throw new ConflictException('passMarks cannot exceed maxMarks');
    }
  }

  private async ensureWeightLimit(
    actor: AuthContext,
    examTermId: string,
    subjectId: string,
    requestedWeight: Prisma.Decimal,
    excludeComponentId?: string,
  ) {
    const aggregate = await this.prisma.assessmentComponent.aggregate({
      where: {
        tenantId: actor.tenantId,
        examTermId,
        subjectId,
        ...(excludeComponentId ? { id: { not: excludeComponentId } } : {}),
      },
      _sum: { weightPercent: true },
    });

    const totalWeight =
      Number(aggregate._sum.weightPercent ?? 0) + Number(requestedWeight);
    if (totalWeight > 100) {
      throw new ConflictException(
        'Total component weight per subject in an exam term cannot exceed 100%',
      );
    }
  }
}
