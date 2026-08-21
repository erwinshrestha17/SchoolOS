"use client";

import { useCallback, useMemo } from "react";
import type { StudentLookupOption } from "@schoolos/core";
import { studentsApi } from "../../lib/api/students";
import { RemoteCombobox } from "../ui/remote-combobox";

type RemoteStudentSelectorProps = {
  value: string;
  onChange: (studentId: string, option: StudentLookupOption | null) => void;
  selectedOption?: StudentLookupOption | null;
  selectedLabel?: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  hideLabel?: boolean;
  className?: string;
};

export function RemoteStudentSelector({
  value,
  onChange,
  selectedOption,
  selectedLabel,
  academicYearId,
  classId,
  sectionId,
  label = "Student",
  placeholder = "Search for a student",
  disabled,
  clearable,
  hideLabel,
  className,
}: RemoteStudentSelectorProps) {
  const queryKey = useMemo(
    () => [
      "remote-student-options",
      academicYearId ?? null,
      classId ?? null,
      sectionId ?? null,
    ],
    [academicYearId, classId, sectionId],
  );
  const loadPage = useCallback(
    ({
      search,
      page,
      limit,
      signal,
    }: {
      search: string;
      page: number;
      limit: number;
      signal: AbortSignal;
    }) =>
      studentsApi.listStudentOptions(
        {
          search,
          page,
          limit,
          academicYearId,
          classId,
          sectionId,
        },
        signal,
      ),
    [academicYearId, classId, sectionId],
  );

  return (
    <RemoteCombobox
      value={value}
      selectedOption={selectedOption}
      selectedLabel={selectedLabel}
      onChange={onChange}
      queryKey={queryKey}
      loadPage={loadPage}
      getOptionLabel={(option) => option.fullNameEn}
      getOptionDescription={(option) =>
        [option.studentSystemId, option.className, option.sectionName]
          .filter(Boolean)
          .join(" · ")
      }
      label={label}
      placeholder={placeholder}
      searchPlaceholder="Type a name or student code…"
      noResultsMessage="No students match this search."
      errorMessage="Students could not be loaded."
      disabled={disabled}
      clearable={clearable}
      hideLabel={hideLabel}
      className={className}
    />
  );
}
