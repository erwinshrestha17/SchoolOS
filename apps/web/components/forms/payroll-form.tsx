'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const currentYear = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

export function PayrollForm() {
  const queryClient = useQueryClient();
  const [staffDraft, setStaffDraft] = useState({
    firstName: 'Maya',
    lastName: 'Teacher',
    dateOfBirth: '1992-01-01',
    gender: 'FEMALE',
    address: 'Kathmandu',
    joiningDate: today,
    contractType: 'PERMANENT',
    email: `teacher${Date.now()}@schoolos.local`,
    password: 'teacher123',
    roleIds: [] as string[],
  });
  const [contract, setContract] = useState({
    staffId: '',
    contractNumber: `CTR-${currentYear}-001`,
    position: 'Teacher',
    startDate: today,
    baseSalary: 45000,
    allowances: 5000,
    deductions: 0,
  });
  const [run, setRun] = useState({
    periodMonth: new Date().getMonth() + 1,
    periodYear: currentYear,
    workingDays: 30,
    notes: 'Monthly payroll demo run',
  });

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: api.listRoles });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts'],
    queryFn: api.listStaffContracts,
  });
  const payrollRunsQuery = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: api.listPayrollRuns,
  });
  const payslipsQuery = useQuery({
    queryKey: ['payslips'],
    queryFn: api.listPayslips,
  });

  useEffect(() => {
    const teacherRole = rolesQuery.data?.find((role) => role.name === 'teacher');

    if (teacherRole) {
      setStaffDraft((current) =>
        current.roleIds.length ? current : { ...current, roleIds: [teacherRole.id] },
      );
    }
  }, [rolesQuery.data]);

  useEffect(() => {
    const firstStaff = staffQuery.data?.[0];

    if (firstStaff) {
      setContract((current) =>
        current.staffId ? current : { ...current, staffId: firstStaff.id },
      );
    }
  }, [staffQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['staff'] });
    void queryClient.invalidateQueries({ queryKey: ['staff-contracts'] });
    void queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    void queryClient.invalidateQueries({ queryKey: ['payslips'] });
    void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
  };
  const staffMutation = useMutation({
    mutationFn: api.createStaff,
    onSuccess: invalidate,
  });
  const contractMutation = useMutation({
    mutationFn: api.createStaffContract,
    onSuccess: invalidate,
  });
  const runMutation = useMutation({
    mutationFn: api.createPayrollRun,
    onSuccess: invalidate,
  });
  const reviewMutation = useMutation({
    mutationFn: api.reviewPayrollRun,
    onSuccess: invalidate,
  });
  const approveMutation = useMutation({
    mutationFn: api.approvePayrollRun,
    onSuccess: invalidate,
  });
  const postMutation = useMutation({
    mutationFn: api.postPayrollRun,
    onSuccess: invalidate,
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Staff Account</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={staffDraft.firstName}
                onChange={(event) =>
                  setStaffDraft((current) => ({ ...current, firstName: event.target.value }))
                }
                placeholder="First name"
              />
              <input
                value={staffDraft.lastName}
                onChange={(event) =>
                  setStaffDraft((current) => ({ ...current, lastName: event.target.value }))
                }
                placeholder="Last name"
              />
            </div>
            <input
              value={staffDraft.email}
              onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="date"
                value={staffDraft.dateOfBirth}
                onChange={(event) =>
                  setStaffDraft((current) => ({ ...current, dateOfBirth: event.target.value }))
                }
              />
              <input
                type="date"
                value={staffDraft.joiningDate}
                onChange={(event) =>
                  setStaffDraft((current) => ({ ...current, joiningDate: event.target.value }))
                }
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!staffDraft.email || staffDraft.roleIds.length === 0 || staffMutation.isPending}
              onClick={() => staffMutation.mutate(staffDraft)}
            >
              {staffMutation.isPending ? 'Creating...' : 'Create teacher staff'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">HR Contract</p>
          <div className="grid gap-3">
            <select
              value={contract.staffId}
              onChange={(event) => setContract((current) => ({ ...current, staffId: event.target.value }))}
            >
              <option value="">Staff member</option>
              {(staffQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.firstName} {item.lastName} / {item.employeeId}
                </option>
              ))}
            </select>
            <input
              value={contract.contractNumber}
              onChange={(event) =>
                setContract((current) => ({ ...current, contractNumber: event.target.value }))
              }
              placeholder="Contract number"
            />
            <input
              value={contract.position}
              onChange={(event) => setContract((current) => ({ ...current, position: event.target.value }))}
              placeholder="Position"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="number"
                value={contract.baseSalary}
                onChange={(event) =>
                  setContract((current) => ({ ...current, baseSalary: Number(event.target.value) }))
                }
              />
              <input
                type="number"
                value={contract.allowances}
                onChange={(event) =>
                  setContract((current) => ({ ...current, allowances: Number(event.target.value) }))
                }
              />
              <input
                type="number"
                value={contract.deductions}
                onChange={(event) =>
                  setContract((current) => ({ ...current, deductions: Number(event.target.value) }))
                }
              />
            </div>
            <button
              type="button"
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!contract.staffId || contractMutation.isPending}
              onClick={() =>
                contractMutation.mutate({
                  ...contract,
                  startDate: new Date(contract.startDate).toISOString(),
                })
              }
            >
              {contractMutation.isPending ? 'Saving...' : 'Create contract'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Payroll Run</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="number"
                min={1}
                max={12}
                value={run.periodMonth}
                onChange={(event) =>
                  setRun((current) => ({ ...current, periodMonth: Number(event.target.value) }))
                }
              />
              <input
                type="number"
                value={run.periodYear}
                onChange={(event) =>
                  setRun((current) => ({ ...current, periodYear: Number(event.target.value) }))
                }
              />
              <input
                type="number"
                value={run.workingDays}
                onChange={(event) =>
                  setRun((current) => ({ ...current, workingDays: Number(event.target.value) }))
                }
              />
            </div>
            <textarea
              rows={3}
              value={run.notes}
              onChange={(event) => setRun((current) => ({ ...current, notes: event.target.value }))}
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate(run)}
            >
              {runMutation.isPending ? 'Generating...' : 'Generate payroll run'}
            </button>
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Run Approval & Ledger Posting</p>
        <div className="grid gap-3">
          {(payrollRunsQuery.data ?? []).slice(0, 5).map((item) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <div>
                <p className="font-semibold">
                  {item.periodMonth}/{item.periodYear} / {item.status}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Gross Rs {item.grossAmount} / Deductions Rs {item.deductionAmount} / Net Rs {item.netAmount}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                disabled={item.status !== 'DRAFT' || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate(item.id)}
              >
                Review
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                disabled={item.status !== 'REVIEWED' || approveMutation.isPending}
                onClick={() => approveMutation.mutate(item.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={item.status !== 'APPROVED' || postMutation.isPending}
                onClick={() => postMutation.mutate(item.id)}
              >
                Post journal
              </button>
            </div>
          ))}
          {payrollRunsQuery.data?.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No payroll runs yet.</p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Staff"
          items={(staffQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.firstName} ${item.lastName}`,
            secondary: `${item.employeeId} / ${item.roles.join(', ')}`,
          }))}
        />
        <SummaryList
          title="Contracts"
          items={(contractsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.contractNumber} / ${item.position}`,
            secondary: `Base Rs ${item.baseSalary} / allowances Rs ${item.allowances}`,
          }))}
        />
        <SummaryList
          title="Payslips"
          items={(payslipsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.payslipNumber} / ${item.status}`,
            secondary: `Net Rs ${item.netSalary} / issued ${item.issuedAt ? 'yes' : 'no'}`,
          }))}
        />
      </div>

      {[
        staffMutation,
        contractMutation,
        runMutation,
        reviewMutation,
        approveMutation,
        postMutation,
      ].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">{title}</p>
      <div className="grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{item.primary}</p>
              <p className="text-sm text-[var(--muted)]">{item.secondary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No records yet.</p>
        )}
      </div>
    </section>
  );
}
