'use client';

import type {
  AcademicYearSummary,
  AdmissionSummary,
  ClassSummary,
  SectionSummary,
  StudentProfile,
} from '@schoolos/core';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

type StudentDirectoryProps = {
  academicYears: AcademicYearSummary[];
  admissions: AdmissionSummary[];
  classes: ClassSummary[];
  isError: boolean;
  isLoading: boolean;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  sections: SectionSummary[];
  students: StudentProfile[];
};

export function StudentDirectory({
  academicYears,
  admissions,
  classes,
  isError,
  isLoading,
  onOpenPdf,
  pdfError,
  sections,
  students,
}: StudentDirectoryProps) {
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const currentAcademicYear = academicYears.find((year) => year.isCurrent);
  const selectedAcademicYear =
    academicYears.find((year) => year.id === academicYearId) ?? currentAcademicYear;
  const selectedClass = classes.find((classroom) => classroom.id === classId);
  const availableSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
  const selectedSection = availableSections.find((section) => section.id === sectionId);

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) {
      setAcademicYearId(currentAcademicYear.id);
    }
  }, [academicYearId, currentAcademicYear]);

  useEffect(() => {
    if (!classId && classes[0]) {
      setClassId(classes[0].id);
    }
  }, [classId, classes]);

  useEffect(() => {
    if (!sectionId) {
      return;
    }

    const existingSection = sections.find((section) => section.id === sectionId);
    const existingSectionClassId = existingSection?.classId ?? existingSection?.class?.id;

    if (existingSection && existingSectionClassId !== classId) {
      setSectionId('');
    }
  }, [classId, sectionId, sections]);

  const admissionBySystemId = useMemo(() => {
    const map = new Map<string, AdmissionSummary>();

    for (const admission of admissions) {
      map.set(admission.studentSystemId, admission);
    }

    return map;
  }, [admissions]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return students
      .filter((student) => {
        const admission = admissionBySystemId.get(student.studentSystemId);
        const studentClassId = student.class?.id;
        const studentClassName =
          student.className ?? student.class?.name ?? admission?.className ?? '';
        const studentSectionName =
          student.sectionName ?? student.section ?? admission?.sectionName ?? '';
        const academicYearMatches =
          !selectedAcademicYear ||
          !admission?.latestEnrollment ||
          admission.latestEnrollment.academicYear === selectedAcademicYear.name;
        const classMatches =
          !selectedClass ||
          studentClassId === selectedClass.id ||
          studentClassName === selectedClass.name;
        const sectionMatches =
          !selectedSection || studentSectionName === selectedSection.name;
        const searchable = [
          getStudentName(student, admission),
          student.studentSystemId,
          studentClassName,
          studentSectionName,
          ...(student.guardians ?? []).map((guardian) => guardian.primaryPhone),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          academicYearMatches &&
          classMatches &&
          sectionMatches &&
          (!normalizedSearch || searchable.includes(normalizedSearch))
        );
      })
      .sort((first, second) => {
        const firstAdmission = admissionBySystemId.get(first.studentSystemId);
        const secondAdmission = admissionBySystemId.get(second.studentSystemId);
        const firstRoll = first.rollNumber ?? firstAdmission?.rollNumber ?? 99999;
        const secondRoll = second.rollNumber ?? secondAdmission?.rollNumber ?? 99999;

        return firstRoll - secondRoll || getStudentName(first, firstAdmission).localeCompare(
          getStudentName(second, secondAdmission),
        );
      });
  }, [
    admissionBySystemId,
    deferredSearch,
    selectedAcademicYear,
    selectedClass,
    selectedSection,
    students,
  ]);

  if (isLoading) {
    return <DirectorySkeleton />;
  }

  if (isError) {
    return (
      <section className="rounded-2xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-600">
        Student Directory could not load. Refresh the page or check the API connection.
      </section>
    );
  }

  if (classes.length === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">No class created yet</p>
        <p className="mt-2">Create academic years, classes, and sections before browsing students.</p>
        <Link
          href="/dashboard/settings"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
        >
          Open Settings
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label mb-2">Student Directory</p>
            <h2 className="text-xl font-bold text-gray-900">
              Browse roster by class and section
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Select a class/section, search by name or SCH-YYYY-NNNN, and open
              individual student profiles.
            </p>
          </div>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
            {filteredStudents.length} students
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="label mb-2 block">Academic year</span>
            <select
              value={academicYearId}
              onChange={(event) => setAcademicYearId(event.target.value)}
            >
              <option value="">All academic years</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                  {year.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-2 block">Class</span>
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setSectionId('');
              }}
            >
              <option value="">All classes</option>
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-2 block">Section</span>
            <select
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              disabled={!classId}
            >
              <option value="">All sections</option>
              {availableSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-2 block">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or SCH-YYYY-NNNN"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredStudents.map((student) => {
              const admission = admissionBySystemId.get(student.studentSystemId);
              const studentName = getStudentName(student, admission);
              const className =
                student.className ?? student.class?.name ?? admission?.className ?? 'Not assigned';
              const sectionName =
                student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section';
              const rollNumber = student.rollNumber ?? admission?.rollNumber ?? null;
              const primaryGuardian =
                (student.guardians ?? admission?.guardians ?? []).find(
                  (guardian) => guardian.isPrimary,
                ) ?? (student.guardians ?? admission?.guardians ?? [])[0];

              return (
                <article
                  key={student.id}
                  className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-sm font-bold text-primary-700">
                      {initials(studentName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{studentName}</p>
                        <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-600">
                          Active
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {student.studentSystemId} / {className} / {sectionName}
                        {rollNumber ? ` / Roll ${rollNumber}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Guardian phone: {primaryGuardian?.primaryPhone || 'Not available'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link
                      href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                      className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/dashboard/finance?studentId=${encodeURIComponent(student.id)}`}
                      className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                    >
                      Collect Fee
                    </Link>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                      onClick={() => onOpenPdf(student.id, 'id-card')}
                    >
                      Open ID Card
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="font-semibold text-gray-900">No students in selected class</p>
            <p className="mt-2 text-sm text-gray-500">
              Try another class/section, clear the search, or create a new enrollment.
            </p>
          </div>
        )}
      </section>

    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="h-5 w-44 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  );
}

function getStudentName(student: StudentProfile, admission: AdmissionSummary | undefined | null) {
  return (
    student.fullNameEn ||
    [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') ||
    admission?.fullNameEn ||
    'Unnamed student'
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
