'use client';

import { RemoteStaffSelector } from '@/components/staff/remote-staff-selector';

interface StaffSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  selectedLabel?: string;
  disabled?: boolean;
}

export function StaffSelector({
  value,
  onChange,
  label,
  error,
  placeholder = 'Select Staff member',
  selectedLabel,
  disabled,
}: StaffSelectorProps) {
  return (
    <div>
      <RemoteStaffSelector
        value={value}
        onChange={(staffId) => onChange(staffId)}
        selectedLabel={selectedLabel}
        label={label || 'Staff Member'}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error ? (
        <p className="mt-1 text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
