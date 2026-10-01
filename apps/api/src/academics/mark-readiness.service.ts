import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MarkEntryStatus,
  MarkSheetStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

/** Readiness of one assessment component for one section (or whole class). */
export type MarkReadinessState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'REVIEWED'
  | 'LOCKED';

export interface MarkReadinessCell {
  assessmentComponentId: string;
  componentName: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  studentCount: number;
  /** Active students with a final (non-draft) entry. */
  finalCount: number;
  markSheetId: string | null;
  sheetStatus: MarkSheetStatus | null;
  state: MarkReadinessState;
}

export interface MarkReadinessSummary {
  examTermId: string;
  isTermLocked: boolean;
  cells: MarkReadinessCell[];
  totals: Record<MarkReadinessState, number>;
  /** Every required sheet is LOCKED (term can be locked). */
  allLocked: boolean;
  asOf: string;
}

const ENTRY_PAGE = 5000;

/**
 * Server-side class x subject (component x section) readiness projection.
 * Drives the exam-term lock gate (marks must be reviewed and locked before
 * the term - and therefore report cards - can be finalized) and the 6E
 * Academics readiness matrix. Counts are exact, never estimated.
 */
@Injectable()
export class MarkReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getTermReadiness(
    examTermId: string,
    actor: AuthContext,
    filters: { classId?: string } = {},
  ): Promise<MarkReadinessSummary> {
    const term = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
      select: { id: true, isLocked: true },
    });
    if (!term) throw new NotFoundException('Exam term not found');

    const components = await this.prisma.assessmentComponent.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId,
        ...(filters.classId ? { subject: { classId: filters.classId } } : {}),
      },
      select: {
        id: true,
        name: true,
        subject: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ subject: { name: 'asc' } }, { name: 'asc' }],
      take: 1000,
    });
    const classIds = [...new Set(components.map((c) => c.subject.class.id))];

    const [students, sections, sheets] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          tenantId: actor.tenantId,
          classId: { in: classIds },
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        },
        select: { id: true, classId: true, sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classId: { in: classIds } },
        select: { id: true, name: true, classId: true },
      }),
      this.prisma.markSheet.findMany({
        where: { tenantId: actor.tenantId, examTermId },
        select: {
          id: true,
          assessmentComponentId: true,
          sectionId: true,
          status: true,
        },
      }),
    ]);

    const sectionById = new Map(sections.map((s) => [s.id, s]));
    // A student's sheet is their section's, or the class-wide sheet when the
    // student has no (valid) section in this class.
    const scopeOf = (student: { classId: string; sectionId: string | null }) =>
      student.sectionId &&
      sectionById.get(student.sectionId)?.classId === student.classId
        ? student.sectionId
        : null;
    const studentScope = new Map(
      students.map((student) => [student.id, scopeOf(student)]),
    );
    const groupKey = (classId: string, sectionId: string | null) =>
      `${classId}:${sectionId ?? ''}`;
    const studentsByGroup = new Map<string, number>();
    for (const student of students) {
      const key = groupKey(student.classId, scopeOf(student));
      studentsByGroup.set(key, (studentsByGroup.get(key) ?? 0) + 1);
    }

    // Final entries per component+section, paged so large terms stay bounded.
    const finalByCell = new Map<string, number>();
    const componentIds = components.map((c) => c.id);
    let cursor: string | undefined;
    for (;;) {
      const page = await this.prisma.markEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId,
          assessmentComponentId: { in: componentIds },
          status: { not: MarkEntryStatus.DRAFT },
        },
        select: { id: true, assessmentComponentId: true, studentId: true },
        orderBy: { id: 'asc' },
        take: ENTRY_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const entry of page) {
        if (!studentScope.has(entry.studentId)) continue; // not active
        const key = `${entry.assessmentComponentId}:${studentScope.get(entry.studentId) ?? ''}`;
        finalByCell.set(key, (finalByCell.get(key) ?? 0) + 1);
      }
      if (page.length < ENTRY_PAGE) break;
      cursor = page[page.length - 1].id;
    }

    const sheetByCell = new Map(
      sheets.map((sheet) => [
        `${sheet.assessmentComponentId}:${sheet.sectionId ?? ''}`,
        sheet,
      ]),
    );

    const cells: MarkReadinessCell[] = [];
    for (const component of components) {
      const classId = component.subject.class.id;
      const groups = [...studentsByGroup.keys()]
        .filter((key) => key.startsWith(`${classId}:`))
        .map((key) => key.slice(classId.length + 1) || null)
        .sort((a, b) =>
          (a ? (sectionById.get(a)?.name ?? '') : '').localeCompare(
            b ? (sectionById.get(b)?.name ?? '') : '',
          ),
        );
      for (const sectionId of groups) {
        const cellKey = `${component.id}:${sectionId ?? ''}`;
        const sheet = sheetByCell.get(cellKey);
        const studentCount =
          studentsByGroup.get(groupKey(classId, sectionId)) ?? 0;
        const finalCount = finalByCell.get(cellKey) ?? 0;
        cells.push({
          assessmentComponentId: component.id,
          componentName: component.name,
          subjectId: component.subject.id,
          subjectName: component.subject.name,
          classId,
          className: component.subject.class.name,
          sectionId,
          sectionName: sectionId
            ? (sectionById.get(sectionId)?.name ?? null)
            : null,
          studentCount,
          finalCount,
          markSheetId: sheet?.id ?? null,
          sheetStatus: sheet?.status ?? null,
          state: readinessState(sheet?.status ?? null, finalCount),
        });
      }
    }

    const totals: Record<MarkReadinessState, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      RETURNED: 0,
      REVIEWED: 0,
      LOCKED: 0,
    };
    for (const cell of cells) totals[cell.state] += 1;

    return {
      examTermId,
      isTermLocked: term.isLocked,
      cells,
      totals,
      allLocked: cells.length > 0 && cells.every((c) => c.state === 'LOCKED'),
      asOf: new Date().toISOString(),
    };
  }
}

export function readinessState(
  sheetStatus: MarkSheetStatus | null,
  finalCount: number,
): MarkReadinessState {
  switch (sheetStatus) {
    case MarkSheetStatus.LOCKED:
      return 'LOCKED';
    case MarkSheetStatus.REVIEWED:
      return 'REVIEWED';
    case MarkSheetStatus.RETURNED:
      return 'RETURNED';
    case MarkSheetStatus.SUBMITTED:
    case MarkSheetStatus.RESUBMITTED:
      return 'SUBMITTED';
    default:
      return finalCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
  }
}
