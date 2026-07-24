import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { isTeacherOnly } from '../common/security/parent-scope';
import {
  GradeCalculatorService,
  SubjectGradeInput,
  SubjectGradeResult,
  CasSubjectSummary,
  OverallResult,
} from './grade-calculator.service';

export interface StudentPreviewResult {
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string;
    sectionName: string | null;
    rollNumber: number | null;
  };
  examTerm: {
    id: string;
    name: string;
  };
  subjects: Array<
    SubjectGradeResult & {
      casSummary: CasSubjectSummary | null;
    }
  >;
  summary: OverallResult;
  casSummaries: CasSubjectSummary[];
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeCalculator: GradeCalculatorService,
  ) {}

  async previewStudentResult(
    studentId: string,
    actor: AuthContext,
    options: {
      examTermId: string;
      classId?: string;
      sectionId?: string;
      includeCas?: boolean;
    },
  ): Promise<StudentPreviewResult> {
    // 1. Validate student belongs to tenant
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      include: {
        class: true,
        sectionRef: true,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    // Confirmed gap: this endpoint (results:read, held by a base teacher)
    // computed and returned a student's full result across every subject
    // with no check the caller actually teaches them.
    await this.ensureTeacherResultScope(
      actor,
      student.classId,
      student.sectionId,
    );

    // 2. Validate exam term belongs to tenant
    const examTerm = await this.prisma.examTerm.findFirst({
      where: { id: options.examTermId, tenantId: actor.tenantId },
    });
    if (!examTerm) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    // 3. Validate classId if provided
    if (options.classId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: options.classId, tenantId: actor.tenantId },
      });
      if (!cls) {
        throw new NotFoundException('Class not found in this tenant');
      }
    }

    // 4. Validate sectionId if provided
    if (options.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: options.sectionId,
          tenantId: actor.tenantId,
          ...(options.classId ? { classId: options.classId } : {}),
        },
      });
      if (!section) {
        throw new NotFoundException('Section not found in this tenant/class');
      }
    }

    // 5. Load assessment components for this exam term
    const components = await this.prisma.assessmentComponent.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId: options.examTermId,
      },
      include: {
        subject: true,
      },
    });

    // 6. Load mark entries for this student + examTerm
    const markEntries = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId: options.examTermId,
        studentId,
      },
    });

    // 7. Build marks lookup: componentId -> markEntry
    const marksMap = new Map(
      markEntries.map((m) => [m.assessmentComponentId, m]),
    );

    // 8. Group components by subjectId
    const subjectComponentsMap = new Map<
      string,
      {
        subject: {
          id: string;
          name: string;
          code: string;
          passMarks: number | null;
        };
        components: typeof components;
      }
    >();
    for (const comp of components) {
      const subId = comp.subjectId;
      if (!subjectComponentsMap.has(subId)) {
        subjectComponentsMap.set(subId, {
          subject: {
            id: comp.subject.id,
            name: comp.subject.name,
            code: comp.subject.code,
            passMarks: comp.subject.passMarks,
          },
          components: [],
        });
      }
      const entry = subjectComponentsMap.get(subId);
      if (entry) {
        entry.components.push(comp);
      }
    }

    // 9. Calculate per-subject results
    const gradingPolicy = await this.gradeCalculator.getTenantGradingPolicy(
      actor.tenantId,
    );
    const subjectResults: Array<
      SubjectGradeResult & { casSummary: CasSubjectSummary | null }
    > = [];

    for (const [subjectId, data] of subjectComponentsMap) {
      const componentInputs = data.components.map((comp) => {
        const mark = marksMap.get(comp.id);
        return {
          componentId: comp.id,
          componentName: comp.name,
          subjectId: comp.subjectId,
          type: comp.type,
          maxMarks: Number(comp.maxMarks),
          marksObtained: mark ? Number(mark.marksObtained) : null,
          passMarks: comp.passMarks ? Number(comp.passMarks) : null,
          weightPercent: Number(comp.weightPercent),
          status: mark?.status,
          isMissing: !mark,
        };
      });

      const subjectInput: SubjectGradeInput = {
        subjectId,
        subjectName: data.subject.name,
        subjectCode: data.subject.code,
        components: componentInputs,
      };

      const result = this.gradeCalculator.calculateWeightedSubjectGrade(
        subjectInput,
        gradingPolicy,
      );
      subjectResults.push({ ...result, casSummary: null });
    }

    // 10. Load CAS records if requested
    let casSummaries: CasSubjectSummary[] = [];
    if (options.includeCas) {
      const casRecords = await this.prisma.casRecord.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId,
          academicYearId: examTerm.academicYearId,
        },
        include: {
          subject: true,
        },
      });

      const casInputs = casRecords.map((r) => ({
        subjectId: r.subjectId,

        subjectName: r.subject?.name ?? 'General',
        category: r.category,
        score: Number(r.score),
        maxScore: Number(r.maxScore),
      }));

      casSummaries = this.gradeCalculator.summarizeCasRecords(casInputs);

      // Attach CAS summary to matching subject results
      for (const sr of subjectResults) {
        const matchingCas = casSummaries.find(
          (c) => c.subjectId === sr.subjectId,
        );
        if (matchingCas) {
          sr.casSummary = matchingCas;
        }
      }
    }

    // 11. Calculate overall result
    const summary = this.gradeCalculator.calculateOverallGpa(
      subjectResults,
      gradingPolicy,
    );

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        name: `${student.firstNameEn} ${student.lastNameEn}`,
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? null,
        rollNumber: student.rollNumber,
      },
      examTerm: {
        id: examTerm.id,
        name: examTerm.name,
      },
      subjects: subjectResults,
      summary,
      casSummaries,
    };
  }

  async previewClassResults(
    actor: AuthContext,
    options: {
      examTermId: string;
      classId: string;
      sectionId?: string;
      includeCas?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    // Same confirmed gap as previewStudentResult: classId is caller-supplied
    // and mandatory, but was never checked against the actor's own teaching
    // assignments, so any teacher could preview any class's full results.
    await this.ensureTeacherResultScope(
      actor,
      options.classId,
      options.sectionId ?? null,
    );

    // 1. Validate exam term
    const examTerm = await this.prisma.examTerm.findFirst({
      where: { id: options.examTermId, tenantId: actor.tenantId },
    });
    if (!examTerm) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    // 2. Validate class
    const cls = await this.prisma.class.findFirst({
      where: { id: options.classId, tenantId: actor.tenantId },
    });
    if (!cls) {
      throw new NotFoundException('Class not found in this tenant');
    }

    // 3. Validate section if provided
    if (options.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: options.sectionId,
          tenantId: actor.tenantId,
          classId: options.classId,
        },
      });
      if (!section) {
        throw new NotFoundException('Section not found in this tenant/class');
      }
    }

    // 4. Paginate students
    const studentWhere = {
      tenantId: actor.tenantId,
      classId: options.classId,
      ...(options.sectionId ? { sectionId: options.sectionId } : {}),
      lifecycleStatus: 'ACTIVE' as const,
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    // 5. Calculate preview for each student
    const previews = await Promise.all(
      students.map((student) =>
        this.previewStudentResult(student.id, actor, {
          examTermId: options.examTermId,
          classId: options.classId,
          sectionId: options.sectionId,
          includeCas: options.includeCas,
        }),
      ),
    );

    return {
      items: previews.map((p) => ({
        student: p.student,
        summary: p.summary,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async ensureTeacherResultScope(
    actor: AuthContext,
    classId: string,
    sectionId: string | null,
  ) {
    if (!isTeacherOnly(actor)) return;

    const classSections = await this.getTeacherAssignedClassSections(actor);
    // A null on either side is a wildcard match: a class-wide teaching
    // assignment (cs.sectionId === null) covers every section, and a
    // section-agnostic target (sectionId === null) is visible to every
    // section-specific teacher of that class -- mirrors the fix applied to
    // the equivalent (and previously asymmetric) check in
    // cas-records.service.ts::findOne, found via live edge-case testing.
    const inScope = classSections.some(
      (cs) =>
        cs.classId === classId &&
        (cs.sectionId === null ||
          sectionId === null ||
          cs.sectionId === sectionId),
    );
    if (!inScope) {
      throw new ForbiddenException(
        'This result is outside your teaching scope',
      );
    }
  }

  private async getTeacherAssignedClassSections(
    actor: AuthContext,
  ): Promise<Array<{ classId: string; sectionId: string | null }>> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!staff) return [];

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: { tenantId: actor.tenantId, staffId: staff.id },
        select: { classId: true, sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classTeacherId: staff.id },
        select: { id: true, classId: true },
      }),
    ]);

    const combos = new Map<
      string,
      { classId: string; sectionId: string | null }
    >();
    for (const a of assignments) {
      combos.set(`${a.classId}:${a.sectionId ?? 'none'}`, {
        classId: a.classId,
        sectionId: a.sectionId,
      });
    }
    for (const s of classTeacherSections) {
      combos.set(`${s.classId}:${s.id}`, {
        classId: s.classId,
        sectionId: s.id,
      });
    }
    return Array.from(combos.values());
  }
}
