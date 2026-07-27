'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ClassSummary, SectionSummary } from '@schoolos/core';
import { api } from '../api';
import { useTeacherAccess } from '../teacher-access';

export interface TeacherAssignmentScope {
  /** True when the lists below are narrowed to the caller's assignments. */
  isScoped: boolean;
  loading: boolean;
  /** Classes the caller may work in. Full school list for non-teachers. */
  classes: ClassSummary[];
  /** Sections the caller may work in, already filtered by `classId`. */
  sectionsForClass: (classId: string) => SectionSummary[];
  /** Every section the caller may work in, across all their classes. */
  sections: SectionSummary[];
  /** Subject ids the caller is assigned to teach; empty means "no filter". */
  assignedSubjectIds: ReadonlySet<string>;
  /**
   * True when the caller is teacher-scoped and has no active assignment at
   * all — the "no assignment means no data" state, which callers should
   * render as an explicit empty state rather than an empty dropdown.
   */
  hasNoAssignments: boolean;
}

/**
 * Canonical assignment-scope resolver for teacher-facing selectors
 * (Teacher Persona spec 3.1 / P0.4).
 *
 * Every screen that offers a class / section / subject picker must source its
 * options from here instead of dropping `api.listClasses()` straight into a
 * `<select>`: that is how "All Classes", "All Sections" and "All Subjects"
 * options end up in front of a teacher who may only touch their own.
 *
 * This is presentation scope only. The backend independently re-validates
 * every classId, sectionId, subjectId and studentId it is handed, so a
 * hand-crafted request cannot widen what this narrows.
 */
export function useTeacherAssignmentScope(): TeacherAssignmentScope {
  const { isTeacherPersona } = useTeacherAccess();

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
    staleTime: 5 * 60_000,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
    staleTime: 5 * 60_000,
  });
  // Self-scoped for teachers by the backend (academics.service.ts
  // listTeacherAssignments), so this never reveals colleagues' assignments.
  const assignmentsQuery = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: api.listTeacherAssignments,
    enabled: isTeacherPersona,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const allClasses = classesQuery.data ?? [];
    const allSections = sectionsQuery.data ?? [];
    const loading =
      classesQuery.isLoading ||
      sectionsQuery.isLoading ||
      (isTeacherPersona && assignmentsQuery.isLoading);

    if (!isTeacherPersona) {
      return {
        isScoped: false,
        loading,
        classes: allClasses,
        sectionsForClass: (classId: string) =>
          allSections.filter(
            (section) => (section.classId ?? section.class?.id) === classId,
          ),
        sections: allSections,
        assignedSubjectIds: new Set<string>(),
        hasNoAssignments: false,
      };
    }

    const assignedSections = allSections.filter(
      (section) =>
        section.isAssignedClassTeacher || section.isAssignedSubjectTeacher,
    );
    const assignedClassIds = new Set(
      assignedSections
        .map((section) => section.classId ?? section.class?.id)
        .filter((id): id is string => Boolean(id)),
    );
    const assignedSubjectIds = new Set(
      (assignmentsQuery.data ?? [])
        .map((assignment) => assignment.subjectId)
        .filter((id): id is string => Boolean(id)),
    );

    return {
      isScoped: true,
      loading,
      classes: allClasses.filter((item) => assignedClassIds.has(item.id)),
      sectionsForClass: (classId: string) =>
        assignedSections.filter(
          (section) => (section.classId ?? section.class?.id) === classId,
        ),
      sections: assignedSections,
      assignedSubjectIds,
      hasNoAssignments: !loading && assignedSections.length === 0,
    };
  }, [
    assignmentsQuery.data,
    assignmentsQuery.isLoading,
    classesQuery.data,
    classesQuery.isLoading,
    isTeacherPersona,
    sectionsQuery.data,
    sectionsQuery.isLoading,
  ]);
}
