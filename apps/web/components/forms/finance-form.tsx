'use client';

import type {
  CashierClosePreview,
  CashierCloseSummary,
  DefaulterReminderResult,
  DefaulterSummary,
  DiscountRule,
  FeeHeadSummary,
  FeePlanSummary,
  InvoiceDetail,
  InvoiceSummary,
  JournalEntryView,
  ReceiptView,
  WaiverRecord,
} from '@schoolos/core';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const today = new Date().toISOString().slice(0, 10);

const financeSections = [
  'Collection Counter',
  'Fee Setup',
  'Billing Runs',
  'Discounts & Waivers',
  'Defaulters',
  'Cashier Close',
  'Receipts & Ledger',
] as const;

const paymentMethods = ['CASH', 'BANK', 'CHEQUE', 'TRANSFER', 'MOBILE'] as const;

type FinanceSection = (typeof financeSections)[number];
type PaymentMethod = (typeof paymentMethods)[number];
type CashierCloseFilters = {
  openedAt: string;
  closedAt: string;
  collectorUserId: string;
  paymentMethod: '' | PaymentMethod;
};

type InvoiceLineForUi = {
  id?: string;
  description?: string | null;
  periodLabel?: string | null;
  feeHead?: {
    code?: string | null;
    name?: string | null;
  } | null;
  feeHeadName?: string | null;
  amount?: number | string | null;
  baseAmount?: number | string | null;
  lateFeeAmount?: number | string | null;
  discountAmount?: number | string | null;
  waiverAmount?: number | string | null;
  vatAmount?: number | string | null;
  netAmount?: number | string | null;
  totalAmount?: number | string | null;
};

type InvoiceForUi = InvoiceSummary & {
  student?: InvoiceSummary['student'] & {
    studentSystemId?: string | null;
    className?: string | null;
    sectionName?: string | null;
    guardianPhone?: string | null;
  };
  className?: string | null;
  sectionName?: string | null;
  guardianPhone?: string | null;
  lines?: InvoiceLineForUi[];
};

type PaymentCollectionResult = {
  paymentId: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
  receiptNumber: string | null;
  receiptPdfUrl?: string | null;
};

type CollectPaymentPayload = Record<string, unknown> & {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  narration: string;
};

type JsonMutation = UseMutationResult<unknown, Error, Record<string, unknown>, unknown>;
type DiscountMutation = UseMutationResult<DiscountRule, Error, Record<string, unknown>, unknown>;
type WaiverMutation = UseMutationResult<WaiverRecord, Error, Record<string, unknown>, unknown>;
type ReminderMutation = UseMutationResult<
  DefaulterReminderResult,
  Error,
  Record<string, unknown>,
  unknown
>;
type PaymentMutation = UseMutationResult<PaymentCollectionResult, Error, CollectPaymentPayload, unknown>;
type MutationErrorState = {
  isError: boolean;
  error: Error | null;
};

export function FinanceForm() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<FinanceSection>('Collection Counter');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
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
    method: 'CASH' as PaymentMethod,
    referenceNumber: '',
  });
  const [discount, setDiscount] = useState({
    name: 'Sibling discount',
    reason: 'Approved sibling discount policy',
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
  const [defaulterFilters, setDefaulterFilters] = useState({
    classId: '',
    feeHeadId: '',
  });
  const [selectedReminderInvoiceIds, setSelectedReminderInvoiceIds] = useState<string[]>([]);
  const [cashierClose, setCashierClose] = useState<CashierCloseFilters>(() => ({
    openedAt: `${today}T00:00`,
    closedAt: getLocalDateTimeValue(new Date()),
    collectorUserId: '',
    paymentMethod: '',
  }));
  const [cashierCloseNotes, setCashierCloseNotes] = useState('');
  const [cashierCloseConfirmation, setCashierCloseConfirmation] = useState('');
  const [cashierCloseMessage, setCashierCloseMessage] = useState('');

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
  const invoiceDetailQuery = useQuery({
    queryKey: ['invoice-detail', payment.invoiceId],
    queryFn: () => api.getInvoiceDetail(payment.invoiceId),
    enabled: Boolean(payment.invoiceId),
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
    queryKey: ['defaulters', defaulterFilters],
    queryFn: () =>
      api.listDefaulters({
        classId: defaulterFilters.classId || null,
        feeHeadId: defaulterFilters.feeHeadId || null,
      }),
  });
  const discountsQuery = useQuery({
    queryKey: ['discounts'],
    queryFn: api.listDiscounts,
  });
  const waiversQuery = useQuery({
    queryKey: ['waivers'],
    queryFn: api.listWaivers,
  });
  const cashierClosePreviewQuery = useQuery({
    queryKey: ['cashier-close-preview', cashierClose],
    queryFn: () => api.previewCashierClose(cashierCloseQueryParams(cashierClose)),
    enabled: activeSection === 'Cashier Close' && Boolean(cashierClose.openedAt && cashierClose.closedAt),
  });
  const cashierClosesQuery = useQuery({
    queryKey: ['cashier-closes'],
    queryFn: () =>
      api.listCashierCloses({
        openedFrom: toIsoDateTime(cashierClose.openedAt),
        closedTo: toIsoDateTime(cashierClose.closedAt),
        collectorUserId: cashierClose.collectorUserId || null,
        paymentMethod: cashierClose.paymentMethod || null,
      }),
    enabled: activeSection === 'Cashier Close' && Boolean(cashierClose.openedAt && cashierClose.closedAt),
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
    const firstInvoice = (invoicesQuery.data as InvoiceForUi[] | undefined)?.find(
      (invoice) => invoice.status !== 'PAID',
    );

    if (firstInvoice) {
      const remaining = getOutstanding(firstInvoice);
      setPayment((current) =>
        current.invoiceId
          ? current
          : { ...current, invoiceId: firstInvoice.id, amount: remaining || current.amount },
      );
      setWaiver((current) =>
        current.invoiceId
          ? current
          : { ...current, invoiceId: firstInvoice.id, amount: Math.min(500, remaining || 500) },
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
  const paymentMutation = useMutation<PaymentCollectionResult, Error, CollectPaymentPayload>({
    mutationFn: async (payload) => (await api.collectPayment(payload)) as PaymentCollectionResult,
    onSuccess: () => {
      setPaymentError(null);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['defaulters'] });
    },
    onError: (error) => setPaymentError(error.message),
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
  const reminderMutation = useMutation({
    mutationFn: api.sendDefaulterReminders,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['defaulters'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      setSelectedReminderInvoiceIds([]);
    },
  });
  const cashierCloseMutation = useMutation({
    mutationFn: () =>
      api.finalizeCashierClose({
        ...cashierCloseQueryParams(cashierClose),
        notes: cashierCloseNotes.trim() || null,
      }),
    onSuccess: async (close) => {
      setCashierCloseMessage(`Cashier close ${close.closeNumber} finalized.`);
      setCashierCloseConfirmation('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cashier-closes'] }),
        queryClient.invalidateQueries({ queryKey: ['cashier-close-preview'] }),
        queryClient.invalidateQueries({ queryKey: ['receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      ]);
    },
  });

  const invoices = (invoicesQuery.data ?? []) as InvoiceForUi[];
  const selectedInvoice = invoices.find((invoice) => invoice.id === payment.invoiceId);
  const selectedInvoiceDetail = invoiceDetailQuery.data;
  const selectedWaiverInvoice = invoices.find((invoice) => invoice.id === waiver.invoiceId);
  const outstanding =
    selectedInvoiceDetail?.outstandingAmount ??
    (selectedInvoice ? getOutstanding(selectedInvoice) : 0);
  const selectedWaiverOutstanding = selectedWaiverInvoice ? getOutstanding(selectedWaiverInvoice) : 0;
  const filteredInvoices = invoices.filter((invoice) => matchesInvoiceSearch(invoice, invoiceSearch));
  const outstandingInvoices = filteredInvoices.filter((invoice) => getOutstanding(invoice) > 0);
  const selectedInvoiceLines = (selectedInvoiceDetail?.lines ??
    selectedInvoice?.lines ??
    []) as InvoiceLineForUi[];
  const overpaymentBlocked = Boolean(selectedInvoice && payment.amount > outstanding);
  const invalidPaymentAmount = payment.amount <= 0 || overpaymentBlocked;
  const requiresReference = payment.method !== 'CASH';
  const defaulters = defaultersQuery.data ?? [];

  function toggleReminderInvoice(invoiceId: string) {
    setSelectedReminderInvoiceIds((current) =>
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId],
    );
  }

  function selectInvoice(invoice: InvoiceForUi) {
    setPaymentError(null);
    setPayment((current) => ({
      ...current,
      invoiceId: invoice.id,
      amount: getOutstanding(invoice) || current.amount,
      referenceNumber: '',
    }));
  }

  function submitPayment() {
    if (!selectedInvoice) {
      setPaymentError('Select an outstanding invoice before collecting payment.');
      return;
    }

    if (payment.amount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (payment.amount > outstanding) {
      setPaymentError('Payment amount cannot exceed the outstanding balance.');
      return;
    }

    if (requiresReference && !payment.referenceNumber.trim()) {
      setPaymentError('Reference number is required for non-cash payments.');
      return;
    }

    const payload: CollectPaymentPayload = {
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      method: payment.method,
      narration: `Counter collection for ${selectedInvoice.invoiceNumber}`,
    };

    if (payment.referenceNumber.trim()) {
      payload.referenceNumber = payment.referenceNumber.trim();
    }

    paymentMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <section className="shell-card rounded-[28px] p-4 sm:p-5">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Finance sections">
          {financeSections.map((section) => (
            <button
              key={section}
              type="button"
              className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${
                activeSection === section
                  ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                  : 'border-[var(--line)] bg-white text-gray-700 hover:border-gray-900 hover:text-gray-950'
              }`}
              onClick={() => setActiveSection(section)}
            >
              {section}
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'Collection Counter' ? (
        <CollectionCounterSection
          invoicesQuery={invoicesQuery}
          invoiceSearch={invoiceSearch}
          setInvoiceSearch={setInvoiceSearch}
          filteredInvoices={filteredInvoices}
          outstandingInvoices={outstandingInvoices}
          selectedInvoice={selectedInvoice}
          invoiceDetailQuery={invoiceDetailQuery}
          selectedInvoiceDetail={selectedInvoiceDetail}
          selectedInvoiceLines={selectedInvoiceLines}
          outstanding={outstanding}
          payment={payment}
          setPayment={setPayment}
          paymentError={paymentError}
          setPaymentError={setPaymentError}
          invalidPaymentAmount={invalidPaymentAmount}
          overpaymentBlocked={overpaymentBlocked}
          requiresReference={requiresReference}
          paymentMutation={paymentMutation}
          selectInvoice={selectInvoice}
          submitPayment={submitPayment}
        />
      ) : null}

      {activeSection === 'Fee Setup' ? (
        <FeeSetupSection
          feeHead={feeHead}
          setFeeHead={setFeeHead}
          feePlan={feePlan}
          setFeePlan={setFeePlan}
          academicYears={academicYearsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          feeHeads={feeHeadsQuery.data ?? []}
          feeHeadMutation={feeHeadMutation}
          feePlanMutation={feePlanMutation}
        />
      ) : null}

      {activeSection === 'Billing Runs' ? (
        <BillingRunsSection
          billingRun={billingRun}
          setBillingRun={setBillingRun}
          academicYears={academicYearsQuery.data ?? []}
          feePlans={feePlansQuery.data ?? []}
          billingRunMutation={billingRunMutation}
        />
      ) : null}

      {activeSection === 'Discounts & Waivers' ? (
        <DiscountsAndWaiversSection
          discount={discount}
          setDiscount={setDiscount}
          waiver={waiver}
          setWaiver={setWaiver}
          feeHeads={feeHeadsQuery.data ?? []}
          classes={classesQuery.data ?? []}
          feePlans={feePlansQuery.data ?? []}
          invoices={invoices}
          selectedWaiverInvoice={selectedWaiverInvoice}
          selectedWaiverOutstanding={selectedWaiverOutstanding}
          discountMutation={discountMutation}
          waiverMutation={waiverMutation}
          discounts={discountsQuery.data ?? []}
          waivers={waiversQuery.data ?? []}
        />
      ) : null}

      {activeSection === 'Defaulters' ? (
        <DefaultersSection
          defaulters={defaulters}
          classes={classesQuery.data ?? []}
          feeHeads={feeHeadsQuery.data ?? []}
          defaulterFilters={defaulterFilters}
          setDefaulterFilters={setDefaulterFilters}
          selectedReminderInvoiceIds={selectedReminderInvoiceIds}
          toggleReminderInvoice={toggleReminderInvoice}
          reminderMutation={reminderMutation}
        />
      ) : null}

      {activeSection === 'Cashier Close' ? (
        <CashierCloseSection
          filters={cashierClose}
          setFilters={setCashierClose}
          notes={cashierCloseNotes}
          setNotes={setCashierCloseNotes}
          confirmation={cashierCloseConfirmation}
          setConfirmation={setCashierCloseConfirmation}
          message={cashierCloseMessage}
          previewQuery={cashierClosePreviewQuery}
          closesQuery={cashierClosesQuery}
          closeMutation={cashierCloseMutation}
        />
      ) : null}

      {activeSection === 'Receipts & Ledger' ? (
        <ReceiptsLedgerSection
          invoices={invoices}
          receipts={receiptsQuery.data ?? []}
          ledgerEntries={ledgerQuery.data ?? []}
          receiptsLoading={receiptsQuery.isLoading}
          ledgerLoading={ledgerQuery.isLoading}
        />
      ) : null}

      <MutationErrors
        mutations={[
          feeHeadMutation,
          feePlanMutation,
          billingRunMutation,
          discountMutation,
          waiverMutation,
          reminderMutation,
        ]}
      />
    </div>
  );
}

function CollectionCounterSection({
  invoicesQuery,
  invoiceSearch,
  setInvoiceSearch,
  filteredInvoices,
  outstandingInvoices,
  selectedInvoice,
  selectedInvoiceDetail,
  invoiceDetailQuery,
  selectedInvoiceLines,
  outstanding,
  payment,
  setPayment,
  paymentError,
  setPaymentError,
  invalidPaymentAmount,
  overpaymentBlocked,
  requiresReference,
  paymentMutation,
  selectInvoice,
  submitPayment,
}: {
  invoicesQuery: UseQueryResult<InvoiceSummary[], Error>;
  invoiceSearch: string;
  setInvoiceSearch: (value: string) => void;
  filteredInvoices: InvoiceForUi[];
  outstandingInvoices: InvoiceForUi[];
  selectedInvoice: InvoiceForUi | undefined;
  selectedInvoiceDetail: InvoiceDetail | undefined;
  invoiceDetailQuery: UseQueryResult<InvoiceDetail, Error>;
  selectedInvoiceLines: InvoiceLineForUi[];
  outstanding: number;
  payment: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    referenceNumber: string;
  };
  setPayment: React.Dispatch<
    React.SetStateAction<{
      invoiceId: string;
      amount: number;
      method: PaymentMethod;
      referenceNumber: string;
    }>
  >;
  paymentError: string | null;
  setPaymentError: (value: string | null) => void;
  invalidPaymentAmount: boolean;
  overpaymentBlocked: boolean;
  requiresReference: boolean;
  paymentMutation: PaymentMutation;
  selectInvoice: (invoice: InvoiceForUi) => void;
  submitPayment: () => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
        <div className="shell-card rounded-[28px] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="label">Collection Counter</p>
              <h2 className="mt-2 text-xl font-bold text-gray-950">Find student or invoice</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Search by student name, school ID, or invoice number. No fake production IDs are used.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {outstandingInvoices.length} outstanding
            </span>
          </div>

          <label className="mt-5 block">
            <span className="label mb-2 block">Student / Invoice Search</span>
            <input
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder="Search by name, SCH-YYYY-NNNN, or invoice number"
              aria-label="Search invoices by student name, school ID, or invoice number"
              className="min-h-11"
            />
          </label>

          <div className="mt-5 grid gap-3">
            {invoicesQuery.isLoading ? (
              <InvoiceSkeleton />
            ) : outstandingInvoices.length > 0 ? (
              outstandingInvoices.slice(0, 8).map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  className={`min-h-16 rounded-2xl border p-4 text-left transition ${
                    selectedInvoice?.id === invoice.id
                      ? 'border-[var(--teal)] bg-emerald-50'
                      : 'border-[var(--line)] bg-white hover:border-[var(--teal)]'
                  }`}
                  onClick={() => selectInvoice(invoice)}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-semibold text-gray-950">
                        {invoice.student?.name ?? 'Student'} / {invoice.invoiceNumber}
                      </span>
                      <span className="mt-1 block text-sm text-[var(--muted)]">
                        {invoice.student?.studentSystemId ?? 'School ID unavailable'} / due{' '}
                        {formatDate(invoice.dueDate)}
                      </span>
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {formatCurrency(getOutstanding(invoice))}
                    </span>
                  </span>
                  <span className="mt-3 inline-flex text-xs font-semibold text-[var(--teal)]">
                    View invoice details
                  </span>
                </button>
              ))
            ) : (
              <EmptyState
                title="No outstanding invoices"
                body={
                  filteredInvoices.length === 0
                    ? 'No invoices match this search.'
                    : 'All matching invoices are fully paid.'
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <InvoiceProfileCard invoice={selectedInvoice} outstanding={outstanding} />
        <OutstandingDuesTable invoice={selectedInvoice} lines={selectedInvoiceLines} />
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          detail={selectedInvoiceDetail}
          detailQuery={invoiceDetailQuery}
        />
        <PaymentPanel
          selectedInvoice={selectedInvoice}
          payment={payment}
          setPayment={setPayment}
          outstanding={outstanding}
          paymentError={paymentError}
          setPaymentError={setPaymentError}
          overpaymentBlocked={overpaymentBlocked}
          invalidPaymentAmount={invalidPaymentAmount}
          requiresReference={requiresReference}
          paymentMutation={paymentMutation}
          submitPayment={submitPayment}
        />
        <LedgerPreview invoice={selectedInvoice} amount={payment.amount} method={payment.method} />
        <PaymentSuccessPanel result={paymentMutation.data} invoice={selectedInvoice} />
      </div>
    </section>
  );
}

function InvoiceProfileCard({
  invoice,
  outstanding,
}: {
  invoice: InvoiceForUi | undefined;
  outstanding: number;
}) {
  if (!invoice) {
    return (
      <section className="shell-card rounded-[28px] p-6">
        <p className="label">Selected Student</p>
        <EmptyState
          title="Choose an invoice"
          body="Student, guardian, and outstanding balance details will appear here."
        />
      </section>
    );
  }

  const paidAmount = Number(invoice.paidAmount ?? 0);

  return (
    <section className="shell-card rounded-[28px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="label">Selected Student</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {invoice.student?.name ?? 'Student'}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {invoice.student?.studentSystemId ?? 'Student system ID unavailable'}
          </p>
        </div>
        <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
          {invoice.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact label="Invoice" value={invoice.invoiceNumber} />
        <Fact label="Due Date" value={formatDate(invoice.dueDate)} />
        <Fact label="Class / Section" value={formatClassSection(invoice)} />
        <Fact label="Guardian Phone" value={invoice.student?.guardianPhone ?? invoice.guardianPhone ?? 'Not available'} />
        <Fact label="Paid" value={formatCurrency(paidAmount)} />
        <Fact label="Outstanding" value={formatCurrency(outstanding)} highlight />
      </div>
    </section>
  );
}

function OutstandingDuesTable({
  invoice,
  lines,
}: {
  invoice: InvoiceForUi | undefined;
  lines: InvoiceLineForUi[];
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Outstanding Dues</p>
      {invoice && lines.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              <tr>
                <th className="py-3 pr-4">Fee Head</th>
                <th className="py-3 pr-4">Period</th>
                <th className="py-3 pr-4">Amount</th>
                <th className="py-3 pr-4">Late Fee</th>
                <th className="py-3 pr-4">Discount</th>
                <th className="py-3 pr-4">VAT</th>
                <th className="py-3 pr-4">Net Due</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id ?? index} className="border-t border-[var(--line)]">
                  <td className="py-3 pr-4 font-semibold">
                    {line.feeHead?.name ?? line.feeHeadName ?? line.description ?? 'Fee item'}
                  </td>
                  <td className="py-3 pr-4 text-[var(--muted)]">{line.periodLabel ?? 'Invoice period'}</td>
                  <td className="py-3 pr-4">{formatCurrency(line.baseAmount ?? line.amount)}</td>
                  <td className="py-3 pr-4">{formatCurrency(line.lateFeeAmount)}</td>
                  <td className="py-3 pr-4">{formatCurrency(line.discountAmount ?? line.waiverAmount)}</td>
                  <td className="py-3 pr-4">{formatCurrency(line.vatAmount)}</td>
                  <td className="py-3 pr-4 font-semibold">{formatCurrency(line.netAmount ?? line.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : invoice ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white/70 p-4">
          <p className="font-semibold text-gray-950">Invoice-level summary</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            The current invoice API does not expose line items to the web client yet, so this counter shows
            the verified invoice-level balance only.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Fact label="Total" value={formatCurrency(invoice.totalAmount)} />
            <Fact label="Paid" value={formatCurrency(invoice.paidAmount)} />
            <Fact label="Net Due" value={formatCurrency(getOutstanding(invoice))} highlight />
          </div>
        </div>
      ) : (
        <EmptyState title="No invoice selected" body="Select an outstanding invoice to review dues." />
      )}
    </section>
  );
}

function InvoiceDetailPanel({
  detail,
  detailQuery,
  invoice,
}: {
  detail: InvoiceDetail | undefined;
  detailQuery: UseQueryResult<InvoiceDetail, Error>;
  invoice: InvoiceForUi | undefined;
}) {
  const queryClient = useQueryClient();
  const [refundPayment, setRefundPayment] = useState<InvoiceDetail['payments'][number] | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [refundConfirmation, setRefundConfirmation] = useState('');
  const [refundMessage, setRefundMessage] = useState('');
  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!refundPayment) {
        throw new Error('Select a payment to reverse or refund.');
      }

      return api.refundPayment(refundPayment.id, {
        amount: refundAmount,
        reason: refundReason.trim(),
        referenceNumber: refundReference.trim() || undefined,
        narration: `Phase 1B correction for ${refundPayment.receipt?.receiptNumber ?? refundPayment.id}`,
      });
    },
    onSuccess: async (result) => {
      setRefundMessage(
        `Refund ${result.refundNumber} created. Invoice status is now ${result.invoiceStatus}.`,
      );
      setRefundPayment(null);
      setRefundReason('');
      setRefundReference('');
      setRefundConfirmation('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoice-detail', invoice?.id] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['receipts'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['defaulters'] }),
        detail?.student.id
          ? queryClient.invalidateQueries({
              queryKey: ['student-fee-ledger', detail.student.id],
            })
          : Promise.resolve(),
      ]);
    },
  });
  const refundableAmount = refundPayment
    ? getPaymentRefundableAmount(refundPayment)
    : 0;
  const refundBlocked =
    !refundPayment ||
    refundAmount <= 0 ||
    refundAmount > refundableAmount ||
    !refundReason.trim() ||
    refundConfirmation !== 'REFUND';

  function openRefundWorkflow(payment: InvoiceDetail['payments'][number]) {
    const refundable = getPaymentRefundableAmount(payment);

    setRefundPayment(payment);
    setRefundAmount(refundable);
    setRefundReason('');
    setRefundReference('');
    setRefundConfirmation('');
    setRefundMessage('');
    refundMutation.reset();
  }

  return (
    <section className="shell-card rounded-[28px] p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">Invoice Detail</p>
          <h3 className="mt-2 text-lg font-bold text-gray-950">
            {invoice?.invoiceNumber ?? 'Select an invoice'}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Official totals, line items, payments, receipts, and source metadata come from the backend.
          </p>
        </div>
        {detail ? (
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
            Outstanding {formatCurrency(detail.outstandingAmount)}
          </span>
        ) : null}
      </div>

      {!invoice ? (
        <EmptyState title="No invoice selected" body="Choose an invoice to open the detail view." />
      ) : detailQuery.isLoading ? (
        <InvoiceSkeleton />
      ) : detailQuery.isError ? (
        <InlineError message={detailQuery.error.message} />
      ) : detail ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Student" value={detail.student.name} />
            <Fact label="School ID" value={detail.student.studentSystemId} />
            <Fact label="Guardian" value={detail.student.guardianPhone ?? 'Not recorded'} />
            <Fact label="Academic Year" value={detail.academicYear.name} />
            <Fact label="Subtotal" value={formatCurrency(detail.subtotal)} />
            <Fact label="VAT" value={formatCurrency(detail.vatAmount)} />
            <Fact label="Paid" value={formatCurrency(detail.paidAmount)} />
            <Fact label="Outstanding" value={formatCurrency(detail.outstandingAmount)} highlight />
          </div>

          <div>
            <p className="label mb-3">Line Items</p>
            {detail.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <tr>
                      <th className="py-3 pr-4">Fee Head</th>
                      <th className="py-3 pr-4">Period</th>
                      <th className="py-3 pr-4">Base</th>
                      <th className="py-3 pr-4">Waiver</th>
                      <th className="py-3 pr-4">VAT</th>
                      <th className="py-3 pr-4">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id} className="border-t border-[var(--line)]">
                        <td className="py-3 pr-4 font-semibold">{line.feeHeadName}</td>
                        <td className="py-3 pr-4 text-[var(--muted)]">{line.periodLabel}</td>
                        <td className="py-3 pr-4">{formatCurrency(line.baseAmount)}</td>
                        <td className="py-3 pr-4">{formatCurrency(line.waiverAmount)}</td>
                        <td className="py-3 pr-4">{formatCurrency(line.vatAmount)}</td>
                        <td className="py-3 pr-4 font-semibold">{formatCurrency(line.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No line items" body="This invoice has no line item records." />
            )}
          </div>

          <div>
            <p className="label mb-3">Payments & Receipts</p>
            {detail.payments.length > 0 ? (
              <div className="grid gap-3">
                {detail.payments.map((payment) => (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-[var(--line)] bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-950">
                          {formatPaymentMethod(payment.method)} / {formatCurrency(payment.netAmount)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Paid {formatDate(payment.paidAt)}
                          {payment.journalEntryNumber
                            ? ` / Journal ${payment.journalEntryNumber}`
                            : ''}
                        </p>
                        {payment.refundedAmount > 0 ? (
                          <p className="mt-1 text-sm text-amber-700">
                            Refunded {formatCurrency(payment.refundedAmount)}
                          </p>
                        ) : null}
                      </div>
                      {payment.receipt ? (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <button
                            type="button"
                            className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-gray-700"
                            onClick={() => void api.openReceiptPdf(payment.receipt!.receiptNumber)}
                          >
                            Open receipt {payment.receipt.receiptNumber}
                          </button>
                          <button
                            type="button"
                            className="min-h-11 rounded-full border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 disabled:opacity-50"
                            disabled={getPaymentRefundableAmount(payment) <= 0}
                            onClick={() => openRefundWorkflow(payment)}
                          >
                            Refund / Reverse
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            No receipt
                          </span>
                          <button
                            type="button"
                            className="min-h-11 rounded-full border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 disabled:opacity-50"
                            disabled={getPaymentRefundableAmount(payment) <= 0}
                            onClick={() => openRefundWorkflow(payment)}
                          >
                            Refund / Reverse
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No payments yet" body="Payments and receipt PDFs will appear after collection." />
            )}
          </div>
          {refundPayment ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">Payment reversal / correction</p>
              <p className="mt-1 text-sm text-amber-800">
                This creates a reversal/refund record. It does not edit the original payment.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Fact
                  label="Original payment"
                  value={formatCurrency(refundPayment.amount)}
                />
                <Fact
                  label="Refundable balance"
                  value={formatCurrency(refundableAmount)}
                />
                <label>
                  <span className="label mb-2 block">Refund amount</span>
                  <input
                    type="number"
                    min={0.01}
                    max={refundableAmount}
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(Number(event.target.value))}
                    className="min-h-11"
                  />
                </label>
                <label>
                  <span className="label mb-2 block">Reference / correction note</span>
                  <input
                    value={refundReference}
                    onChange={(event) => setRefundReference(event.target.value)}
                    placeholder="Optional counter, bank, or correction reference"
                    className="min-h-11"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="label mb-2 block">Reason</span>
                  <textarea
                    value={refundReason}
                    onChange={(event) => setRefundReason(event.target.value)}
                    placeholder="Required audited reason for this reversal/correction"
                    rows={3}
                    className="min-h-24"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="label mb-2 block">Confirmation text: type REFUND</span>
                  <input
                    value={refundConfirmation}
                    onChange={(event) => setRefundConfirmation(event.target.value)}
                    className="min-h-11"
                  />
                </label>
              </div>
              {refundAmount > refundableAmount ? (
                <InlineError message="Refund amount cannot exceed the refundable balance." />
              ) : null}
              {refundMutation.error ? (
                <InlineError message={refundMutation.error.message} />
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-amber-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={refundBlocked || refundMutation.isPending}
                  onClick={() => refundMutation.mutate()}
                >
                  {refundMutation.isPending ? 'Creating refund...' : 'Confirm refund / reversal'}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-semibold text-gray-700"
                  onClick={() => setRefundPayment(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {refundMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {refundMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PaymentPanel({
  selectedInvoice,
  payment,
  setPayment,
  outstanding,
  paymentError,
  setPaymentError,
  overpaymentBlocked,
  invalidPaymentAmount,
  requiresReference,
  paymentMutation,
  submitPayment,
}: {
  selectedInvoice: InvoiceForUi | undefined;
  payment: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    referenceNumber: string;
  };
  setPayment: React.Dispatch<
    React.SetStateAction<{
      invoiceId: string;
      amount: number;
      method: PaymentMethod;
      referenceNumber: string;
    }>
  >;
  outstanding: number;
  paymentError: string | null;
  setPaymentError: (value: string | null) => void;
  overpaymentBlocked: boolean;
  invalidPaymentAmount: boolean;
  requiresReference: boolean;
  paymentMutation: PaymentMutation;
  submitPayment: () => void;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Payment Panel</p>
      <div className="mt-4 grid gap-4">
        <label>
          <span className="label mb-2 block">Amount to Collect</span>
          <input
            type="number"
            min={1}
            max={outstanding || undefined}
            value={payment.amount}
            onChange={(event) => {
              setPaymentError(null);
              setPayment((current) => ({ ...current, amount: Number(event.target.value) }));
            }}
            disabled={!selectedInvoice}
            aria-label="Amount to collect"
            className="min-h-11"
          />
        </label>
        {overpaymentBlocked ? (
          <InlineError message="Payment amount cannot exceed the outstanding balance." />
        ) : null}
        {payment.amount <= 0 ? <InlineError message="Payment amount must be greater than zero." /> : null}

        <label>
          <span className="label mb-2 block">Payment Method</span>
          <select
            value={payment.method}
            onChange={(event) => {
              setPaymentError(null);
              setPayment((current) => ({
                ...current,
                method: event.target.value as PaymentMethod,
                referenceNumber: event.target.value === 'CASH' ? '' : current.referenceNumber,
              }));
            }}
            disabled={!selectedInvoice}
            className="min-h-11"
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {formatPaymentMethod(method)}
              </option>
            ))}
          </select>
        </label>

        {requiresReference ? (
          <label>
            <span className="label mb-2 block">
              {payment.method === 'CHEQUE' ? 'Cheque / Bank Reference Number' : 'Reference Number'}
            </span>
            <input
              value={payment.referenceNumber}
              onChange={(event) => {
                setPaymentError(null);
                setPayment((current) => ({ ...current, referenceNumber: event.target.value }));
              }}
              placeholder={
                payment.method === 'CHEQUE'
                  ? 'Cheque number, issuing bank, or counter reference'
                  : 'Bank, transfer, or mobile reference'
              }
              disabled={!selectedInvoice}
              className="min-h-11"
            />
          </label>
        ) : null}

        {paymentError ? <InlineError message={paymentError} /> : null}

        <button
          type="button"
          className="min-h-12 rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
          disabled={!selectedInvoice || invalidPaymentAmount || paymentMutation.isPending}
          onClick={submitPayment}
        >
          {paymentMutation.isPending ? 'Posting payment...' : 'Confirm Payment & Generate Receipt'}
        </button>
      </div>
    </section>
  );
}

function LedgerPreview({
  invoice,
  amount,
  method,
}: {
  invoice: InvoiceForUi | undefined;
  amount: number;
  method: PaymentMethod;
}) {
  const debitAccount = method === 'CASH' ? 'Cash on Hand' : `${formatPaymentMethod(method)} Clearing`;
  const creditAmount = invoice ? Math.min(Math.max(amount, 0), getOutstanding(invoice)) : 0;

  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Ledger Entry Preview</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Preview only - backend posts final ledger entry after confirmation.
      </p>
      <div className="mt-4 grid gap-3">
        <LedgerPreviewRow side="Dr" account={debitAccount} amount={creditAmount} />
        <LedgerPreviewRow side="Cr" account="Fee Income / VAT Payable" amount={creditAmount} />
      </div>
    </section>
  );
}

function PaymentSuccessPanel({
  result,
  invoice,
}: {
  result: PaymentCollectionResult | undefined;
  invoice: InvoiceForUi | undefined;
}) {
  if (!result) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
      <p className="label text-emerald-700">Receipt Generated</p>
      <h2 className="mt-2 text-xl font-bold text-emerald-950">
        {result.receiptNumber ?? 'Receipt created'}
      </h2>
      <p className="mt-2 text-sm text-emerald-800">
        {formatCurrency(result.amount)} collected for {invoice?.invoiceNumber ?? 'invoice'} by{' '}
        {formatPaymentMethod(result.method)}.
      </p>
      {result.receiptNumber ? (
        <button
          type="button"
          className="mt-4 min-h-11 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white"
          onClick={() => void api.openReceiptPdf(result.receiptNumber as string)}
        >
          Open receipt PDF
        </button>
      ) : null}
    </section>
  );
}

function FeeSetupSection({
  feeHead,
  setFeeHead,
  feePlan,
  setFeePlan,
  academicYears,
  classes,
  feeHeads,
  feeHeadMutation,
  feePlanMutation,
}: {
  feeHead: {
    code: string;
    name: string;
    frequency: string;
    defaultAmount: number;
    vatApplicable: boolean;
  };
  setFeeHead: React.Dispatch<React.SetStateAction<typeof feeHead>>;
  feePlan: {
    academicYearId: string;
    classId: string;
    feeHeadId: string;
    code: string;
    name: string;
    amount: number;
  };
  setFeePlan: React.Dispatch<React.SetStateAction<typeof feePlan>>;
  academicYears: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  feeHeads: FeeHeadSummary[];
  feeHeadMutation: JsonMutation;
  feePlanMutation: JsonMutation;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Fee Head Setup</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
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
            <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm">
              <input
                type="checkbox"
                checked={feeHead.vatApplicable}
                onChange={(event) =>
                  setFeeHead((current) => ({ ...current, vatApplicable: event.target.checked }))
                }
              />
              VAT applicable
            </label>
          </div>
          <button
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
            disabled={!feeHead.code || !feeHead.name || feeHeadMutation.isPending}
            onClick={() => feeHeadMutation.mutate(feeHead)}
          >
            {feeHeadMutation.isPending ? 'Saving...' : 'Create fee head'}
          </button>
        </div>
      </div>

      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Fee Plan Setup</p>
        <div className="grid gap-3">
          <select
            value={feePlan.academicYearId}
            onChange={(event) =>
              setFeePlan((current) => ({ ...current, academicYearId: event.target.value }))
            }
          >
            <option value="">Academic year</option>
            {academicYears.map((year) => (
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
            {classes.map((classroom) => (
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
            {feeHeads.map((head) => (
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
    </section>
  );
}

function BillingRunsSection({
  billingRun,
  setBillingRun,
  academicYears,
  feePlans,
  billingRunMutation,
}: {
  billingRun: {
    academicYearId: string;
    feePlanId: string;
    runMonth: number;
    runYear: number;
    dueDate: string;
  };
  setBillingRun: React.Dispatch<React.SetStateAction<typeof billingRun>>;
  academicYears: Array<{ id: string; name: string }>;
  feePlans: FeePlanSummary[];
  billingRunMutation: JsonMutation;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">Billing Runs</p>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr_auto] lg:items-end">
        <select
          value={billingRun.academicYearId}
          onChange={(event) =>
            setBillingRun((current) => ({ ...current, academicYearId: event.target.value }))
          }
        >
          <option value="">Academic year</option>
          {academicYears.map((year) => (
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
          {feePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.code} / {plan.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={12}
          value={billingRun.runMonth}
          onChange={(event) =>
            setBillingRun((current) => ({ ...current, runMonth: Number(event.target.value) }))
          }
          aria-label="Billing run month"
        />
        <input
          type="number"
          value={billingRun.runYear}
          onChange={(event) =>
            setBillingRun((current) => ({ ...current, runYear: Number(event.target.value) }))
          }
          aria-label="Billing run year"
        />
        <input
          type="date"
          value={billingRun.dueDate}
          onChange={(event) =>
            setBillingRun((current) => ({ ...current, dueDate: event.target.value }))
          }
          aria-label="Billing run due date"
        />
        <button
          className="min-h-11 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
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
    </section>
  );
}

function DiscountsAndWaiversSection({
  discount,
  setDiscount,
  waiver,
  setWaiver,
  feeHeads,
  classes,
  feePlans,
  invoices,
  selectedWaiverInvoice,
  selectedWaiverOutstanding,
  discountMutation,
  waiverMutation,
  discounts,
  waivers,
}: {
  discount: {
    name: string;
    reason: string;
    type: string;
    feeHeadId: string;
    classId: string;
    feePlanId: string;
    percentOff: number;
    amountOff: number;
  };
  setDiscount: React.Dispatch<React.SetStateAction<typeof discount>>;
  waiver: {
    invoiceId: string;
    feeHeadId: string;
    amount: number;
    reason: string;
  };
  setWaiver: React.Dispatch<React.SetStateAction<typeof waiver>>;
  feeHeads: FeeHeadSummary[];
  classes: Array<{ id: string; name: string }>;
  feePlans: FeePlanSummary[];
  invoices: InvoiceForUi[];
  selectedWaiverInvoice: InvoiceForUi | undefined;
  selectedWaiverOutstanding: number;
  discountMutation: DiscountMutation;
  waiverMutation: WaiverMutation;
  discounts: DiscountRule[];
  waivers: WaiverRecord[];
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
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
            <input
              value={discount.reason}
              onChange={(event) =>
                setDiscount((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Approval reason"
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
              {feeHeads.map((head) => (
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
              {classes.map((item) => (
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
              {feePlans.map((plan) => (
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
              !discount.reason ||
              (!discount.feeHeadId && !discount.classId && !discount.feePlanId) ||
              discountMutation.isPending
            }
            onClick={() =>
              discountMutation.mutate({
                name: discount.name,
                reason: discount.reason,
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
              Choose at least one fee head, class, or plan so the rule can apply during billing.
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
              const invoice = invoices.find((item) => item.id === event.target.value);
              const remaining = invoice ? getOutstanding(invoice) : waiver.amount;
              setWaiver((current) => ({
                ...current,
                invoiceId: event.target.value,
                amount: Math.min(current.amount || 500, remaining || current.amount),
              }));
            }}
          >
            <option value="">Select invoice</option>
            {invoices.map((invoice) => (
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
            {feeHeads.map((head) => (
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
              Selected outstanding balance: {formatCurrency(selectedWaiverOutstanding)}
            </p>
          ) : null}
          <button
            className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
            disabled={!selectedWaiverInvoice?.student?.id || waiver.amount <= 0 || waiverMutation.isPending}
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

      <SummaryList
        title="Discounts"
        items={discounts.slice(0, 5).map((item) => ({
          id: item.id,
          primary: item.name,
          secondary: `${item.type} / ${item.percentOff ?? 0}% / ${formatCurrency(item.amountOff)}`,
        }))}
      />
      <SummaryList
        title="Waivers"
        items={waivers.slice(0, 5).map((item) => ({
          id: item.id,
          primary: `${item.status} / ${formatCurrency(item.amount)}`,
          secondary: item.reason,
        }))}
      />
    </section>
  );
}

function DefaultersSection({
  defaulters,
  classes,
  feeHeads,
  defaulterFilters,
  setDefaulterFilters,
  selectedReminderInvoiceIds,
  toggleReminderInvoice,
  reminderMutation,
}: {
  defaulters: DefaulterSummary[];
  classes: Array<{ id: string; name: string }>;
  feeHeads: FeeHeadSummary[];
  defaulterFilters: { classId: string; feeHeadId: string };
  setDefaulterFilters: React.Dispatch<React.SetStateAction<{ classId: string; feeHeadId: string }>>;
  selectedReminderInvoiceIds: string[];
  toggleReminderInvoice: (invoiceId: string) => void;
  reminderMutation: ReminderMutation;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label">Defaulters</p>
          <h2 className="mt-2 text-xl font-bold text-gray-950">Reminder queue</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Filter overdue invoices and send provider-neutral reminder delivery records.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={defaulterFilters.classId}
            onChange={(event) =>
              setDefaulterFilters((current) => ({
                ...current,
                classId: event.target.value,
              }))
            }
          >
            <option value="">All classes</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
          <select
            value={defaulterFilters.feeHeadId}
            onChange={(event) =>
              setDefaulterFilters((current) => ({
                ...current,
                feeHeadId: event.target.value,
              }))
            }
          >
            <option value="">All fee heads</option>
            {feeHeads.map((head) => (
              <option key={head.id} value={head.id}>
                {head.code} / {head.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {defaulters.map((defaulter) => (
          <label key={defaulter.invoiceId} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedReminderInvoiceIds.includes(defaulter.invoiceId)}
                onChange={() => toggleReminderInvoice(defaulter.invoiceId)}
              />
              <span>
                <span className="block font-semibold">{defaulter.studentName}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {defaulter.invoiceNumber} / {defaulter.agingBucket} / {formatCurrency(defaulter.outstanding)}
                  {defaulter.reportCardBlocked ? ' / report card blocked' : ''}
                  {defaulter.hallTicketBlocked ? ' / hall ticket blocked' : ''}
                </span>
              </span>
            </span>
          </label>
        ))}
        {defaulters.length === 0 ? <EmptyState title="No defaulters" body="No overdue invoices match the filters." /> : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="min-h-11 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={defaulters.length === 0 || reminderMutation.isPending}
          onClick={() =>
            reminderMutation.mutate({
              classId: defaulterFilters.classId || null,
              feeHeadId: defaulterFilters.feeHeadId || null,
              channels: ['EMAIL', 'SMS', 'PUSH'],
              message: 'Fee payment reminder from SchoolOS.',
            })
          }
        >
          Remind all filtered
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={selectedReminderInvoiceIds.length === 0 || reminderMutation.isPending}
          onClick={() =>
            reminderMutation.mutate({
              invoiceIds: selectedReminderInvoiceIds,
              channels: ['EMAIL', 'SMS', 'PUSH'],
              message: 'Fee payment reminder from SchoolOS.',
            })
          }
        >
          Remind selected
        </button>
      </div>
      {reminderMutation.data ? (
        <p className="mt-3 text-sm text-[var(--teal)]">
          Reminded {reminderMutation.data.reminded} of {reminderMutation.data.requested} invoices
          across {reminderMutation.data.channels.join(', ')}.
        </p>
      ) : null}
    </section>
  );
}

function CashierCloseSection({
  closeMutation,
  closesQuery,
  confirmation,
  filters,
  message,
  notes,
  previewQuery,
  setConfirmation,
  setFilters,
  setNotes,
}: {
  closeMutation: UseMutationResult<CashierCloseSummary, Error, void, unknown>;
  closesQuery: UseQueryResult<CashierCloseSummary[], Error>;
  confirmation: string;
  filters: CashierCloseFilters;
  message: string;
  notes: string;
  previewQuery: UseQueryResult<CashierClosePreview, Error>;
  setConfirmation: (value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<CashierCloseFilters>>;
  setNotes: (value: string) => void;
}) {
  const preview = previewQuery.data;
  const groupedTotals = preview
    ? {
        cash: filters.paymentMethod === '' || filters.paymentMethod === 'CASH' ? preview.netCollected : 0,
        bank: filters.paymentMethod === '' || filters.paymentMethod === 'BANK' ? preview.netCollected : 0,
        cheque: filters.paymentMethod === '' || filters.paymentMethod === 'CHEQUE' ? preview.netCollected : 0,
        digital:
          filters.paymentMethod === '' || filters.paymentMethod === 'TRANSFER' || filters.paymentMethod === 'MOBILE'
            ? preview.netCollected
            : 0,
      }
    : null;
  const canClose =
    Boolean(preview) &&
    confirmation === 'CLOSE' &&
    !previewQuery.isError &&
    !closeMutation.isPending;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
      <div className="space-y-6">
        <section className="shell-card rounded-[28px] p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="label">Cashier Close / Day-End</p>
              <h2 className="mt-2 text-xl font-bold text-gray-950">Preview close totals</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Closing records the day-end cash position. It does not edit payments.
              </p>
            </div>
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
              Immutable snapshot
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="label mb-2 block">Opened at</span>
              <input
                type="datetime-local"
                value={filters.openedAt}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, openedAt: event.target.value }))
                }
                className="min-h-11"
              />
            </label>
            <label>
              <span className="label mb-2 block">Closed at</span>
              <input
                type="datetime-local"
                value={filters.closedAt}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, closedAt: event.target.value }))
                }
                className="min-h-11"
              />
            </label>
            <label>
              <span className="label mb-2 block">Payment method</span>
              <select
                value={filters.paymentMethod}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    paymentMethod: event.target.value as CashierCloseFilters['paymentMethod'],
                  }))
                }
                className="min-h-11"
              >
                <option value="">All methods</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {formatPaymentMethod(method)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-2 block">Cashier / collector ID</span>
              <input
                value={filters.collectorUserId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, collectorUserId: event.target.value }))
                }
                placeholder="Optional user ID filter"
                className="min-h-11"
              />
            </label>
          </div>

          {previewQuery.isLoading ? (
            <div className="mt-5">
              <InvoiceSkeleton />
            </div>
          ) : previewQuery.isError ? (
            <InlineError message={previewQuery.error.message} />
          ) : preview ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Fact label="Gross collected" value={formatCurrency(preview.grossCollected)} />
                <Fact label="Refund / reversal total" value={formatCurrency(preview.totalRefunded)} />
                <Fact label="Net collection" value={formatCurrency(preview.netCollected)} highlight />
                <Fact label="Receipt count" value={String(preview.paymentCount)} />
                <Fact label="Refund count" value={String(preview.refundCount)} />
                <Fact label="First receipt" value={preview.firstReceiptNumber ?? 'None'} />
                <Fact label="Last receipt" value={preview.lastReceiptNumber ?? 'None'} />
                <Fact label="Method filter" value={filters.paymentMethod || 'All methods'} />
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <p className="label mb-3">Printable Day-End Summary</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Fact label="Cash total" value={formatCurrency(groupedTotals?.cash ?? 0)} />
                  <Fact label="Bank total" value={formatCurrency(groupedTotals?.bank ?? 0)} />
                  <Fact label="Cheque total" value={formatCurrency(groupedTotals?.cheque ?? 0)} />
                  <Fact label="Digital total" value={formatCurrency(groupedTotals?.digital ?? 0)} />
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Method-level totals use the selected backend filter. Select each payment method for an official
                  method-specific close preview; PDF export is intentionally not generated in this slice.
                </p>
              </div>

              <label className="block">
                <span className="label mb-2 block">Close notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for day-end handoff or cash variance explanation"
                  rows={3}
                  className="min-h-24"
                />
              </label>
              <label className="block">
                <span className="label mb-2 block">Confirmation text: type CLOSE</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="min-h-11"
                />
              </label>

              {closeMutation.error ? <InlineError message={closeMutation.error.message} /> : null}
              {message ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  {message}
                </p>
              ) : null}

              <button
                type="button"
                className="min-h-12 rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
                disabled={!canClose}
                onClick={() => closeMutation.mutate()}
              >
                {closeMutation.isPending ? 'Finalizing close...' : 'Finalize day-end close'}
              </button>
            </div>
          ) : (
            <EmptyState title="No close preview" body="Choose a valid window to preview day-end totals." />
          )}
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Previous Closes</p>
        {closesQuery.isLoading ? (
          <InvoiceSkeleton />
        ) : closesQuery.isError ? (
          <InlineError message={closesQuery.error.message} />
        ) : closesQuery.data && closesQuery.data.length > 0 ? (
          <div className="grid gap-3">
            {closesQuery.data.slice(0, 8).map((close) => (
              <article key={close.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-950">{close.closeNumber}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatDate(close.openedAt)} - {formatDate(close.closedAt)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Receipts {close.firstReceiptNumber ?? 'none'} to {close.lastReceiptNumber ?? 'none'}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {formatCurrency(close.netCollected)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                  <span>Gross: {formatCurrency(close.grossCollected)}</span>
                  <span>Refunds: {formatCurrency(close.totalRefunded)}</span>
                  <span>Payments: {close.paymentCount} / Refunds: {close.refundCount}</span>
                  {close.notes ? <span>Notes: {close.notes}</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No cashier closes yet" body="Finalized day-end closes will appear here." />
        )}
      </section>
    </section>
  );
}

function ReceiptsLedgerSection({
  invoices,
  receipts,
  ledgerEntries,
  receiptsLoading,
  ledgerLoading,
}: {
  invoices: InvoiceForUi[];
  receipts: ReceiptView[];
  ledgerEntries: JournalEntryView[];
  receiptsLoading: boolean;
  ledgerLoading: boolean;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <SummaryList
        title="Invoices"
        items={invoices.slice(0, 6).map((invoice) => ({
          id: invoice.id,
          primary: `${invoice.invoiceNumber} / ${invoice.status}`,
          secondary: `${invoice.student?.name ?? 'Student'} / paid ${formatCurrency(invoice.paidAmount)} of ${formatCurrency(invoice.totalAmount)}`,
        }))}
      />
      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Receipts</p>
        <div className="grid gap-3">
          {receiptsLoading ? (
            <InvoiceSkeleton />
          ) : receipts.length > 0 ? (
            receipts.slice(0, 6).map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="font-semibold">{receipt.receiptNumber}</p>
                <p className="text-sm text-[var(--muted)]">
                  {receipt.student?.name ?? 'Student'} / {formatCurrency(receipt.amount)}
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-10 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold"
                  onClick={() => void api.openReceiptPdf(receipt.receiptNumber)}
                >
                  Open receipt PDF
                </button>
              </div>
            ))
          ) : (
            <EmptyState title="No receipts yet" body="Confirmed payments will generate receipts here." />
          )}
        </div>
      </section>
      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Ledger</p>
        <div className="grid gap-3">
          {ledgerLoading ? (
            <InvoiceSkeleton />
          ) : ledgerEntries.length > 0 ? (
            ledgerEntries.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                <p className="font-semibold">{entry.entryNumber}</p>
                <p className="text-sm text-[var(--muted)]">
                  {entry.narration} / debit {formatCurrency(sumLedgerLines(entry, 'DEBIT'))}, credit{' '}
                  {formatCurrency(sumLedgerLines(entry, 'CREDIT'))}
                </p>
              </div>
            ))
          ) : (
            <EmptyState title="No ledger entries yet" body="Posted collections will appear after backend confirmation." />
          )}
        </div>
      </section>
    </section>
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
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
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

function Fact({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-[var(--line)] bg-white/70'}`}>
      <p className="label">{label}</p>
      <p className="mt-1 font-semibold text-gray-950">{value}</p>
    </div>
  );
}

function LedgerPreviewRow({
  side,
  account,
  amount,
}: {
  side: string;
  account: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
      <div>
        <p className="font-semibold text-gray-950">
          {side} {account}
        </p>
        <p className="text-sm text-[var(--muted)]">Accounting posts final balanced entry server-side.</p>
      </div>
      <span className="font-semibold">{formatCurrency(amount)}</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 p-5 text-sm">
      <p className="font-semibold text-gray-950">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{body}</p>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

function MutationErrors({ mutations }: { mutations: MutationErrorState[] }) {
  const errors = mutations.filter(
    (mutationState): mutationState is { isError: true; error: Error } =>
      mutationState.isError && Boolean(mutationState.error),
  );

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      {errors.map((mutationState, index) => (
        <InlineError key={index} message={mutationState.error.message} />
      ))}
    </div>
  );
}

function matchesInvoiceSearch(invoice: InvoiceForUi, search: string) {
  const normalized = search.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    invoice.invoiceNumber,
    invoice.student?.name,
    invoice.student?.studentSystemId,
    invoice.className,
    invoice.student?.className,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function getOutstanding(invoice: InvoiceForUi) {
  return Math.max(0, Number(invoice.totalAmount ?? 0) - Number(invoice.paidAmount ?? 0));
}

function getPaymentRefundableAmount(payment: InvoiceDetail['payments'][number]) {
  return Math.max(0, Number(payment.amount ?? 0) - Number(payment.refundedAmount ?? 0));
}

function cashierCloseQueryParams(filters: CashierCloseFilters) {
  return {
    openedAt: toIsoDateTime(filters.openedAt),
    closedAt: toIsoDateTime(filters.closedAt),
    collectorUserId: filters.collectorUserId.trim() || null,
    paymentMethod: filters.paymentMethod || null,
  };
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function getLocalDateTimeValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;

  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatCurrency(value: number | string | null | undefined) {
  return `Rs. ${Number(value ?? 0).toLocaleString('en-NP', {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatPaymentMethod(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatClassSection(invoice: InvoiceForUi) {
  const className = invoice.student?.className ?? invoice.className;
  const sectionName = invoice.student?.sectionName ?? invoice.sectionName;

  if (!className && !sectionName) {
    return 'Not available';
  }

  return [className, sectionName].filter(Boolean).join(' / ');
}

function sumLedgerLines(entry: JournalEntryView, side: 'DEBIT' | 'CREDIT') {
  return (
    entry.lines
      ?.filter((line) => line.side === side)
      .reduce((sum, line) => sum + Number(line.amount), 0) ?? 0
  );
}
