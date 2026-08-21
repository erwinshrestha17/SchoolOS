"use client";

import { useCallback } from "react";
import type { StaffLookupOption } from "@schoolos/core";
import { payrollApi } from "../../lib/api/payroll";
import { RemoteCombobox } from "../ui/remote-combobox";

const STAFF_OPTIONS_QUERY_KEY = ["remote-staff-options"] as const;

type RemoteStaffSelectorProps = {
  value: string;
  onChange: (staffId: string, option: StaffLookupOption | null) => void;
  selectedOption?: StaffLookupOption | null;
  selectedLabel?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  hideLabel?: boolean;
  className?: string;
};

export function RemoteStaffSelector({
  value,
  onChange,
  selectedOption,
  selectedLabel,
  label = "Staff member",
  placeholder = "Search for a staff member",
  disabled,
  clearable,
  hideLabel,
  className,
}: RemoteStaffSelectorProps) {
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
    }) => payrollApi.listStaffOptions({ search, page, limit }, signal),
    [],
  );

  return (
    <RemoteCombobox
      value={value}
      selectedOption={selectedOption}
      selectedLabel={selectedLabel}
      onChange={onChange}
      queryKey={STAFF_OPTIONS_QUERY_KEY}
      loadPage={loadPage}
      getOptionLabel={(option) => option.fullName}
      getOptionDescription={(option) =>
        [option.employeeId, option.designation, option.department]
          .filter(Boolean)
          .join(" · ")
      }
      label={label}
      placeholder={placeholder}
      searchPlaceholder="Type a name or employee ID…"
      noResultsMessage="No staff members match this search."
      errorMessage="Staff members could not be loaded."
      disabled={disabled}
      clearable={clearable}
      hideLabel={hideLabel}
      className={className}
    />
  );
}
