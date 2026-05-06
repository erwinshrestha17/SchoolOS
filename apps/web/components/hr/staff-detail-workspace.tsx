'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';

export function StaffDetailWorkspace({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const staffQuery = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => api.getStaffDetail(staffId),
  });
  const staff = staffQuery.data;
  const [draft, setDraft] = useState({
    department: '',
    designation: '',
    bankName: '',
    bankAccount: '',
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateStaffDetail(staffId, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
  });

  if (staffQuery.isLoading) {
    return <p className="text-sm text-gray-500">Loading staff profile...</p>;
  }

  if (!staff) {
    return <p className="text-sm text-gray-500">Staff profile not found.</p>;
  }

  const tabs = ['overview', 'employment', 'attendance', 'leave', 'salary', 'payroll'];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {staff.firstName} {staff.lastName}
            </h2>
            <p className="text-sm text-gray-500">
              {staff.employeeId} / {staff.designation ?? 'No designation'} / {staff.status ?? 'ACTIVE'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft({
                department: staff.department ?? '',
                designation: staff.designation ?? '',
                bankName: staff.bankName ?? '',
                bankAccount: staff.bankAccount ?? '',
              })
            }
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
          >
            Load editable fields
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold capitalize ${
              tab === item
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'overview' || tab === 'employment' || tab === 'salary' ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Department" value={draft.department} onChange={(department) => setDraft((current) => ({ ...current, department }))} />
            <Field label="Designation" value={draft.designation} onChange={(designation) => setDraft((current) => ({ ...current, designation }))} />
            <Field label="Bank Name" value={draft.bankName} onChange={(bankName) => setDraft((current) => ({ ...current, bankName }))} />
            <Field label="Bank Account" value={draft.bankAccount} onChange={(bankAccount) => setDraft((current) => ({ ...current, bankAccount }))} />
          </div>
          <button
            type="button"
            onClick={() => updateMutation.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Save size={16} />
            {updateMutation.isPending ? 'Saving...' : 'Save profile'}
          </button>
          {updateMutation.isError ? (
            <p className="mt-3 text-sm text-red-600">{updateMutation.error.message}</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'attendance' ? <Summary title="Attendance" items={staff.attendanceRecords ?? []} /> : null}
      {tab === 'leave' ? <Summary title="Leave" items={staff.leaveRequests ?? []} /> : null}
      {tab === 'payroll' ? <Summary title="Payroll History" items={staff.payrollLines ?? []} /> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-gray-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-gray-200 px-3 py-2 font-normal text-gray-900"
      />
    </label>
  );
}

function Summary({ title, items }: { title: string; items: unknown[] }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <pre className="mt-3 max-h-[360px] overflow-auto rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
        {items.length > 0 ? JSON.stringify(items, null, 2) : 'No records yet.'}
      </pre>
    </section>
  );
}
