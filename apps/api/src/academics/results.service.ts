import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
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

      const result =
        this.gradeCalculator.calculateWeightedSubjectGrade(subjectInput);
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
    const summary = this.gradeCalculator.calculateOverallGpa(subjectResults);

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
}
