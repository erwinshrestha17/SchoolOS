'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';

interface StaffSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function StaffSelector({
  value,
  onChange,
  label,
  error,
  placeholder = 'Select Staff member',
  disabled,
}: StaffSelectorProps) {
  const staffQuery = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => api.listStaff(),
  });

  const options = staffQuery.data?.map((s) => ({
    label: `${s.firstName} ${s.lastName} (${s.employeeId || 'No ID'})`,
    value: s.id,
  })) || [];

  return (
    <FormField label={label || 'Staff Member'} error={error}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || staffQuery.isLoading}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
