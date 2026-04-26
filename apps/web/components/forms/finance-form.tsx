'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);

export function FinanceForm() {
  const queryClient = useQueryClient();
  const [feeHead, setFeeHead] = useState({
    code: 'TUITION-P1',
    name: 'Class 1 Tuition',
    frequency: 'MONTHLY',
    defaultAmount: 3500,
    vatApplicable: true,
  });
  const [feePlan, setFeePlan] = useState({
    academicYearId: '',
    classId: '',
    feeHeadId: '',
    code: 'PLAN-P1',
    name: 'Primary monthly plan',
    amount: 3500,
  });
  const [billingRun, setBillingRun] = useState({
    academicYearId: '',
    feePlanId: '',
    runMonth: new Date().getMonth() + 1,
    runYear: new Date().getFullYear(),
    dueDate: today,
  });
  const [payment, setPayment] = useState({
    invoiceId: '',
    amount: 1000,
    method: 'CASH',
  });
  const [discount, setDiscount] = useState({
    name: 'Sibling discount',
    type: 'SIBLING',
    feeHeadId: '',
    classId: '',
    feePlanId: '',
    percentOff: 10,
    amountOff: 0,
  });
  const [waiver, setWaiver] = useState({
    invoiceId: '',
    feeHeadId: '',
    amount: 500,
    reason: 'Manual approved waiver',
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const feeHeadsQuery = useQuery({
    queryKey: ['fee-heads'],
    queryFn: api.listFeeHeads,
  });
  const feePlansQuery = useQuery({
    queryKey: ['fee-plans'],
    queryFn: api.listFeePlans,
  });
  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: api.listInvoices,
  });
  const receiptsQuery = useQuery({
    queryKey: ['receipts'],
    queryFn: api.listReceipts,
  });
  const ledgerQuery = useQuery({
    queryKey: ['ledger-entries'],
    queryFn: api.listLedgerEntries,
  });
  const defaultersQuery = useQuery({
    queryKey: ['defaulters'],
    queryFn: api.listDefaulters,
  });
  const discountsQuery = useQuery({
    queryKey: ['discounts'],
    queryFn: api.listDiscounts,
  });
  const waiversQuery = useQuery({
    queryKey: ['waivers'],
    queryFn: api.listWaivers,
  });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find((year) => year.isCurrent);
    const firstAcademicYear = currentAcademicYear ?? academicYearsQuery.data?.[0];

    if (firstAcademicYear) {
      setFeePlan((current) =>
        current.academicYearId ? current : { ...current, academicYearId: firstAcademicYear.id },
      );
      setBillingRun((current) =>
        current.academicYearId ? current : { ...current, academicYearId: firstAcademicYear.id },
      );
    }
  }, [academicYearsQuery.data]);

  useEffect(() => {
    const firstFeeHead = feeHeadsQuery.data?.[0];

    if (firstFeeHead) {
      setFeePlan((current) =>
        current.feeHeadId
          ? current
          : { ...current, feeHeadId: firstFeeHead.id, amount: Number(firstFeeHead.defaultAmount) },
      );
      setDiscount((current) =>
        current.feeHeadId ? current : { ...current, feeHeadId: firstFeeHead.id },
      );
    }
  }, [feeHeadsQuery.data]);

  useEffect(() => {
    const firstFeePlan = feePlansQuery.data?.[0];

    if (firstFeePlan) {
      setBillingRun((current) =>
        current.feePlanId ? current : { ...current, feePlanId: firstFeePlan.id },
      );
    }
  }, [feePlansQuery.data]);

  useEffect(() => {
    const firstInvoice = invoicesQuery.data?.find((invoice) => invoice.status !== 'PAID');

    if (firstInvoice) {
      const outstanding = Math.max(
        0,
        Number(firstInvoice.totalAmount) - Number(firstInvoice.paidAmount ?? 0),
      );
      setPayment((current) =>
        current.invoiceId
          ? current
          : { ...current, invoiceId: firstInvoice.id, amount: outstanding || current.amount },
      );
      setWaiver((current) =>
        current.invoiceId
          ? current
          : { ...current, invoiceId: firstInvoice.id, amount: Math.min(500, outstanding || 500) },
      );
    }
  }, [invoicesQuery.data]);

  const feeHeadMutation = useMutation({
    mutationFn: api.createFeeHead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['fee-heads'] }),
  });
  const feePlanMutation = useMutation({
    mutationFn: api.createFeePlan,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['fee-plans'] }),
  });
  const billingRunMutation = useMutation({
    mutationFn: api.generateBillingRun,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-plans'] });
    },
  });
  const paymentMutation = useMutation({
    mutationFn: api.collectPayment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['defaulters'] });
    },
  });
  const discountMutation = useMutation({
    mutationFn: api.createDiscount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discounts'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-plans'] });
    },
  });
  const waiverMutation = useMutation({
    mutationFn: api.createWaiver,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['waivers'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['defaulters'] });
    },
  });

  const selectedInvoice = invoicesQuery.data?.find((invoice) => invoice.id === payment.invoiceId);
  const selectedWaiverInvoice = invoicesQuery.data?.find((invoice) => invoice.id === waiver.invoiceId);
  const outstanding = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.totalAmount) - Number(selectedInvoice.paidAmount ?? 0))
    : 0;
  const selectedWaiverOutstanding = selectedWaiverInvoice
    ? Math.max(
        0,
        Number(selectedWaiverInvoice.totalAmount) - Number(selectedWaiverInvoice.paidAmount ?? 0),
      )
    : 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Fee Head</p>
          <div className="grid gap-3">
            <input
              value={feeHead.code}
              onChange={(event) => setFeeHead((current) => ({ ...current, code: event.target.value }))}
              placeholder="Code"
            />
            <input
              value={feeHead.name}
              onChange={(event) => setFeeHead((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name"
            />
            <input
              type="number"
              value={feeHead.defaultAmount}
              onChange={(event) =>
                setFeeHead((current) => ({
                  ...current,
                  defaultAmount: Number(event.target.value),
                }))
              }
              placeholder="Default amount"
            />
            <button
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
              onClick={() => feeHeadMutation.mutate(feeHead)}
            >
              {feeHeadMutation.isPending ? 'Saving...' : 'Create fee head'}
            </button>
          </div>
        </div>

        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Fee Plan</p>
          <div className="grid gap-3">
            <select
              value={feePlan.academicYearId}
              onChange={(event) =>
                setFeePlan((current) => ({ ...current, academicYearId: event.target.value }))
              }
            >
              <option value="">Academic year</option>
              {(academicYearsQuery.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
            <select
              value={feePlan.classId}
              onChange={(event) => setFeePlan((current) => ({ ...current, classId: event.target.value }))}
            >
              <option value="">All classes</option>
              {(classesQuery.data ?? []).map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
            <select
              value={feePlan.feeHeadId}
              onChange={(event) =>
                setFeePlan((current) => ({ ...current, feeHeadId: event.target.value }))
              }
            >
              <option value="">Fee head</option>
              {(feeHeadsQuery.data ?? []).map((head) => (
                <option key={head.id} value={head.id}>
                  {head.code} / {head.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={feePlan.code}
                onChange={(event) => setFeePlan((current) => ({ ...current, code: event.target.value }))}
                placeholder="Plan code"
              />
              <input
                value={feePlan.name}
                onChange={(event) => setFeePlan((current) => ({ ...current, name: event.target.value }))}
                placeholder="Plan name"
              />
              <input
                type="number"
                value={feePlan.amount}
                onChange={(event) =>
                  setFeePlan((current) => ({ ...current, amount: Number(event.target.value) }))
                }
                placeholder="Amount"
              />
            </div>
            <button
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!feePlan.academicYearId || !feePlan.feeHeadId || feePlanMutation.isPending}
              onClick={() =>
                feePlanMutation.mutate({
                  academicYearId: feePlan.academicYearId,
                  classId: feePlan.classId || null,
                  code: feePlan.code,
                  name: feePlan.name,
                  items: [{ feeHeadId: feePlan.feeHeadId, amount: feePlan.amount }],
                })
              }
            >
              {feePlanMutation.isPending ? 'Creating...' : 'Create fee plan'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Billing Run</p>
          <div className="grid gap-3">
            <select
              value={billingRun.academicYearId}
              onChange={(event) =>
                setBillingRun((current) => ({ ...current, academicYearId: event.target.value }))
              }
            >
              <option value="">Academic year</option>
              {(academicYearsQuery.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
            <select
              value={billingRun.feePlanId}
              onChange={(event) =>
                setBillingRun((current) => ({ ...current, feePlanId: event.target.value }))
              }
            >
              <option value="">All active fee plans</option>
              {(feePlansQuery.data ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.code} / {plan.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="number"
                min={1}
                max={12}
                value={billingRun.runMonth}
                onChange={(event) =>
                  setBillingRun((current) => ({ ...current, runMonth: Number(event.target.value) }))
                }
              />
              <input
                type="number"
                value={billingRun.runYear}
                onChange={(event) =>
                  setBillingRun((current) => ({ ...current, runYear: Number(event.target.value) }))
                }
              />
              <input
                type="date"
                value={billingRun.dueDate}
                onChange={(event) =>
                  setBillingRun((current) => ({ ...current, dueDate: event.target.value }))
                }
              />
            </div>
            <button
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!billingRun.academicYearId || billingRunMutation.isPending}
              onClick={() =>
                billingRunMutation.mutate({
                  ...billingRun,
                  feePlanId: billingRun.feePlanId || null,
                  dueDate: new Date(billingRun.dueDate).toISOString(),
                })
              }
            >
              {billingRunMutation.isPending ? 'Generating...' : 'Generate invoices'}
            </button>
          </div>
        </div>

        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Payment Collection</p>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Every collection posts an immutable journal entry and receipt metadata.
          </p>
          <div className="grid gap-3">
            <select
              value={payment.invoiceId}
              onChange={(event) => {
                const invoice = invoicesQuery.data?.find((item) => item.id === event.target.value);
                const remaining = invoice
                  ? Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount ?? 0))
                  : payment.amount;
                setPayment((current) => ({
                  ...current,
                  invoiceId: event.target.value,
                  amount: remaining || current.amount,
                }));
              }}
            >
              <option value="">Select outstanding invoice</option>
              {(invoicesQuery.data ?? []).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} / {invoice.student?.name ?? 'Student'} / Rs {invoice.totalAmount}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min={1}
                value={payment.amount}
                onChange={(event) =>
                  setPayment((current) => ({ ...current, amount: Number(event.target.value) }))
                }
              />
              <select
                value={payment.method}
                onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TRANSFER">Transfer</option>
                <option value="MOBILE">Mobile</option>
              </select>
            </div>
            <button
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!payment.invoiceId || payment.amount <= 0 || paymentMutation.isPending}
              onClick={() =>
                paymentMutation.mutate({
                  ...payment,
                  narration: `Counter collection for ${selectedInvoice?.invoiceNumber ?? 'invoice'}`,
                })
              }
            >
              {paymentMutation.isPending ? 'Posting...' : 'Collect payment'}
            </button>
            {selectedInvoice ? (
              <p className="text-sm text-[var(--muted)]">
                Outstanding balance: Rs {outstanding}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Discount Rule</p>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={discount.name}
                onChange={(event) =>
                  setDiscount((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Discount name"
              />
              <select
                value={discount.type}
                onChange={(event) =>
                  setDiscount((current) => ({ ...current, type: event.target.value }))
                }
              >
                <option value="SIBLING">Sibling</option>
                <option value="SCHOLARSHIP">Scholarship</option>
                <option value="STAFF_CHILD">Staff child</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={discount.feeHeadId}
                onChange={(event) =>
                  setDiscount((current) => ({ ...current, feeHeadId: event.target.value }))
                }
              >
                <option value="">Any fee head</option>
                {(feeHeadsQuery.data ?? []).map((head) => (
                  <option key={head.id} value={head.id}>
                    {head.code}
                  </option>
                ))}
              </select>
              <select
                value={discount.classId}
                onChange={(event) =>
                  setDiscount((current) => ({ ...current, classId: event.target.value }))
                }
              >
                <option value="">Any class</option>
                {(classesQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={discount.feePlanId}
                onChange={(event) =>
                  setDiscount((current) => ({ ...current, feePlanId: event.target.value }))
                }
              >
                <option value="">Any plan</option>
                {(feePlansQuery.data ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min={0}
                value={discount.percentOff}
                onChange={(event) =>
                  setDiscount((current) => ({
                    ...current,
                    percentOff: Number(event.target.value),
                  }))
                }
                placeholder="Percent off"
              />
              <input
                type="number"
                min={0}
                value={discount.amountOff}
                onChange={(event) =>
                  setDiscount((current) => ({
                    ...current,
                    amountOff: Number(event.target.value),
                  }))
                }
                placeholder="Amount off"
              />
            </div>
            <button
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !discount.name ||
                (!discount.feeHeadId && !discount.classId && !discount.feePlanId) ||
                discountMutation.isPending
              }
              onClick={() =>
                discountMutation.mutate({
                  name: discount.name,
                  type: discount.type,
                  feeHeadId: discount.feeHeadId || null,
                  classId: discount.classId || null,
                  feePlanId: discount.feePlanId || null,
                  percentOff: discount.percentOff > 0 ? discount.percentOff : null,
                  amountOff: discount.amountOff > 0 ? discount.amountOff : null,
                })
              }
            >
              {discountMutation.isPending ? 'Saving...' : 'Create discount'}
            </button>
            {!discount.feeHeadId && !discount.classId && !discount.feePlanId ? (
              <p className="text-sm text-[var(--accent-dark)]">
                Choose at least one fee head, class, or plan so the rule can apply
                during billing.
              </p>
            ) : null}
          </div>
        </div>

        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Waiver</p>
          <div className="grid gap-3">
            <select
              value={waiver.invoiceId}
              onChange={(event) => {
                const invoice = invoicesQuery.data?.find((item) => item.id === event.target.value);
                const remaining = invoice
                  ? Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount ?? 0))
                  : waiver.amount;
                setWaiver((current) => ({
                  ...current,
                  invoiceId: event.target.value,
                  amount: Math.min(current.amount || 500, remaining || current.amount),
                }));
              }}
            >
              <option value="">Select invoice</option>
              {(invoicesQuery.data ?? []).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} / {invoice.student?.name ?? 'Student'}
                </option>
              ))}
            </select>
            <select
              value={waiver.feeHeadId}
              onChange={(event) =>
                setWaiver((current) => ({ ...current, feeHeadId: event.target.value }))
              }
            >
              <option value="">Whole invoice</option>
              {(feeHeadsQuery.data ?? []).map((head) => (
                <option key={head.id} value={head.id}>
                  {head.code} / {head.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={waiver.amount}
              onChange={(event) =>
                setWaiver((current) => ({ ...current, amount: Number(event.target.value) }))
              }
              placeholder="Waiver amount"
            />
            <textarea
              rows={3}
              value={waiver.reason}
              onChange={(event) =>
                setWaiver((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Reason"
            />
            {selectedWaiverInvoice ? (
              <p className="text-sm text-[var(--muted)]">
                Selected outstanding balance: Rs {selectedWaiverOutstanding}
              </p>
            ) : null}
            <button
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !selectedWaiverInvoice?.student?.id ||
                waiver.amount <= 0 ||
                waiverMutation.isPending
              }
              onClick={() =>
                waiverMutation.mutate({
                  studentId: selectedWaiverInvoice?.student?.id,
                  invoiceId: waiver.invoiceId || null,
                  feeHeadId: waiver.feeHeadId || null,
                  amount: waiver.amount,
                  reason: waiver.reason,
                })
              }
            >
              {waiverMutation.isPending ? 'Approving...' : 'Approve waiver'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Invoices"
          items={(invoicesQuery.data ?? []).slice(0, 5).map((invoice) => ({
            id: invoice.id,
            primary: `${invoice.invoiceNumber} / ${invoice.status}`,
            secondary: `${invoice.student?.name ?? 'Student'} / paid Rs ${
              invoice.paidAmount ?? 0
            } of Rs ${invoice.totalAmount}`,
          }))}
        />
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Receipts</p>
          <div className="grid gap-3">
            {(receiptsQuery.data ?? []).slice(0, 5).map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <p className="font-semibold">{receipt.receiptNumber}</p>
                <p className="text-sm text-[var(--muted)]">
                  {receipt.student?.name ?? 'Student'} / Rs {receipt.amount ?? 0}
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold"
                  onClick={() => void api.openReceiptPdf(receipt.receiptNumber)}
                >
                  Open receipt PDF
                </button>
              </div>
            ))}
            {receiptsQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No records yet.</p>
            ) : null}
          </div>
        </section>
        <SummaryList
          title="Ledger"
          items={(ledgerQuery.data ?? []).slice(0, 5).map((entry) => ({
            id: entry.id,
            primary: entry.entryNumber,
            secondary: `${entry.narration} / debit Rs ${
              entry.lines
                ?.filter((line) => line.side === 'DEBIT')
                .reduce((sum, line) => sum + Number(line.amount), 0) ?? 0
            }, credit Rs ${
              entry.lines
                ?.filter((line) => line.side === 'CREDIT')
                .reduce((sum, line) => sum + Number(line.amount), 0) ?? 0
            }`,
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Defaulters"
          items={(defaultersQuery.data ?? []).slice(0, 5).map((defaulter) => ({
            id: defaulter.invoiceId,
            primary: defaulter.studentName,
            secondary: `${defaulter.agingBucket} / Rs ${defaulter.outstanding}`,
          }))}
        />
        <SummaryList
          title="Discounts"
          items={(discountsQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: item.name,
            secondary: `${item.type} / ${item.percentOff ?? 0}% / Rs ${item.amountOff ?? 0}`,
          }))}
        />
        <SummaryList
          title="Waivers"
          items={(waiversQuery.data ?? []).slice(0, 5).map((item) => ({
            id: item.id,
            primary: `${item.status} / Rs ${item.amount}`,
            secondary: item.reason,
          }))}
        />
      </div>

      {[
        feeHeadMutation,
        feePlanMutation,
        billingRunMutation,
        paymentMutation,
        discountMutation,
        waiverMutation,
      ].map((mutationState, index) =>
        mutationState.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutationState.error.message}
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
