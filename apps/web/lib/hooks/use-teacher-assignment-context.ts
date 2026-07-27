'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../api';
import type { TeacherAssignmentContextEntry } from '../api/teacher-workspace';
import { useTeacherAccess } from '../teacher-access';

export type TeacherResponsibility = 'SUBJECT_TEACHER' | 'CLASS_TEACHER';

export interface TeacherAssignmentOption extends TeacherAssignmentContextEntry {
  /** "Mathematics — Class 1 A" / "Class Teacher — Class 1 A". */
  label: string;
  responsibility: TeacherResponsibility;
}

function labelFor(entry: TeacherAssignmentContextEntry): string {
  const where = `${entry.className}${entry.sectionName ? ` ${entry.sectionName}` : ''}`;
  if (entry.assignmentType === 'CLASS_TEACHER') {
    return `Class Teacher — ${where}`;
  }
  const subject = entry.subjectName ?? 'Subject';
  return entry.isTemporary
    ? `${subject} (covering) — ${where}`
    : `${subject} — ${where}`;
}

/**
 * The teacher's real assignments, straight from the backend resolver.
 *
 * This is the authority for what a teacher may pick in any creation workflow.
 * It deliberately does not infer scope from section flags or role names: the
 * backend already knows the exact assignment rows, including effective dates
 * and temporary substitutions, and re-validates every id on write regardless
 * of what the UI offered.
 */
export function useTeacherAssignmentContext() {
  const { isTeacherPersona } = useTeacherAccess();

  const query = useQuery({
    queryKey: ['teacher-assignment-context'],
    queryFn: () => api.getMyAssignmentContext(),
    enabled: isTeacherPersona,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const context = query.data;

    const subjectAssignments: TeacherAssignmentOption[] = (
      context?.subjectAssignments ?? []
    ).map((entry) => ({
      ...entry,
      label: labelFor(entry),
      responsibility: 'SUBJECT_TEACHER' as const,
    }));

    const homerooms: TeacherAssignmentOption[] = (
      context?.homerooms ?? []
    ).map((entry) => ({
      ...entry,
      label: labelFor(entry),
      responsibility: 'CLASS_TEACHER' as const,
    }));

    return {
      loading: isTeacherPersona && query.isLoading,
      isError: query.isError,
      /** Only meaningful for the teacher persona; false for administrators. */
      isTeacherPersona,
      subjectAssignments,
      homerooms,
      /** Everything for the "Working as" selector, subjects first. */
      allOptions: [...subjectAssignments, ...homerooms],
      hasAnyAssignment: Boolean(context?.hasAnyAssignment),
      /**
       * "No active assignment means no data access" -- callers render this as
       * an explicit explanation rather than an empty dropdown.
       */
      hasNoAssignments:
        isTeacherPersona && !query.isLoading && !context?.hasAnyAssignment,
      /** The scope a creation workflow should prefill. */
      defaultSubjectAssignment:
        subjectAssignments.find((entry) => entry.isPrimary) ??
        subjectAssignments[0] ??
        null,
      defaultHomeroom: homerooms[0] ?? null,
      refetch: query.refetch,
    };
  }, [isTeacherPersona, query]);
}
