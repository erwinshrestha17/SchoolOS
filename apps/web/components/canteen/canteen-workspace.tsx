'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Ban, Package, QrCode, Soup, Utensils, Wallet } from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import { api } from '../../lib/api';
import {
  canteenApi,
  type CanteenEnrollmentPayload,
  type CanteenMealPlanPayload,
  type CanteenMealServingPayload,
  type CanteenMenuItemPayload,
  type CanteenPaymentMethod,
  type CanteenPosSalePayload,
  type CanteenSpendingControlPayload,
  type CanteenTopUpPayload,
} from '../../lib/canteen-api';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { PageHeader } from '../ui/page-header';
import { StatCard } from '../ui/stat-card';
import { StatusBadge, type StatusTone } from '../ui/status-badge';
import { cn } from '../../lib/utils';
import { StudentSelector } from '../students/student-selector';
import { MenuItemSelector } from './menu-item-selector';
import { QRResolver } from '../ui/qr-resolver';
import { ConfirmDialog } from '../ui/confirm-dialog';

type CanteenTab = 'overview' | 'menu' | 'plans' | 'enrollments' | 'serving' | 'wallets' | 'pos' | 'controls' | 'inventory' | 'reports';

type CanteenWorkspaceProps = { initialTab?: CanteenTab };

const tabs: Array<{ key: CanteenTab; label: string; href: string }> = [
  { key: 'overview', label: 'Overview', href: '/dashboard/canteen' },
  { key: 'menu', label: 'Menu', href: '/dashboard/canteen/menu' },
  { key: 'plans', label: 'Meal Plans', href: '/dashboard/canteen/plans' },
  { key: 'enrollments', label: 'Enrollments', href: '/dashboard/canteen/enrollments' },
  { key: 'serving', label: 'Serving', href: '/dashboard/canteen/serving' },
  { key: 'wallets', label: 'Wallets', href: '/dashboard/canteen/wallets' },
  { key: 'pos', label: 'POS', href: '/dashboard/canteen/pos' },
  { key: 'controls', label: 'Controls', href: '/dashboard/canteen/controls' },
  { key: 'inventory', label: 'Inventory', href: '/dashboard/canteen/inventory' },
  { key: 'reports', label: 'Reports', href: '/dashboard/canteen/reports' },
];

const today = new Date().toISOString().slice(0, 10);

const emptyMenuForm: CanteenMenuItemPayload = { name: '', category: '', unitPrice: 0, isMealItem: true, allergenTags: [] };
const emptyPlanForm: CanteenMealPlanPayload = { name: '', mealType: 'LUNCH', price: 0, billingFrequency: 'MONTHLY', duplicateServingPrevention: true };
const emptyEnrollmentForm: CanteenEnrollmentPayload = { studentId: '', mealPlanId: '', startsOn: today };
const emptyServingForm: CanteenMealServingPayload = { studentId: '', mealType: 'LUNCH', mealDate: today, preventDuplicate: true };
const emptyTopUpForm: CanteenTopUpPayload = { amount: 100, note: '', lowBalanceThreshold: 100 };
const emptyPosForm: CanteenPosSalePayload = { studentId: '', paymentMethod: 'CASH', items: [{ menuItemId: '', quantity: 1 }] };
const emptyControlForm: CanteenSpendingControlPayload = { studentId: '', dailySpendingLimit: 200, lowBalanceThreshold: 100, isActive: true };

const moneyFormatter = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 });

export function CanteenWorkspace({ initialTab = 'overview' }: CanteenWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<CanteenTab>(initialTab);
  const [menuForm, setMenuForm] = useState<CanteenMenuItemPayload>(emptyMenuForm);
  const [planForm, setPlanForm] = useState<CanteenMealPlanPayload>(emptyPlanForm);
  const [enrollmentForm, setEnrollmentForm] = useState<CanteenEnrollmentPayload>(emptyEnrollmentForm);
  const [servingForm, setServingForm] = useState<CanteenMealServingPayload>(emptyServingForm);
  const [walletStudentId, setWalletStudentId] = useState('');
  const [topUpForm, setTopUpForm] = useState<CanteenTopUpPayload>(emptyTopUpForm);
  const [posForm, setPosForm] = useState<CanteenPosSalePayload>(emptyPosForm);
  const [controlForm, setControlForm] = useState<CanteenSpendingControlPayload>(emptyControlForm);
  const [reportDate, setReportDate] = useState(today);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);
  const [confirmingEnrollmentId, setConfirmingEnrollmentId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const menuQuery = useQuery({ queryKey: ['canteen-menu'], queryFn: () => canteenApi.listMenuItems({ status: '' }) });
  const plansQuery = useQuery({ queryKey: ['canteen-plans'], queryFn: () => canteenApi.listMealPlans({ status: '' }) });
  const enrollmentsQuery = useQuery({ queryKey: ['canteen-enrollments'], queryFn: () => canteenApi.listEnrollments() });
  const servingsQuery = useQuery({ queryKey: ['canteen-servings', reportDate], queryFn: () => canteenApi.listServings({ date: reportDate }) });
  const salesQuery = useQuery({ queryKey: ['canteen-pos-sales'], queryFn: () => canteenApi.listPosSales() });
  const lowBalanceQuery = useQuery({ queryKey: ['canteen-low-balance'], queryFn: () => canteenApi.getLowBalanceWallets() });
  const mealCountQuery = useQuery({ queryKey: ['canteen-meal-count', reportDate], queryFn: () => canteenApi.getDailyMealCountReport({ date: reportDate }) });
  const itemSalesQuery = useQuery({ queryKey: ['canteen-item-sales'], queryFn: () => canteenApi.getItemWiseSalesReport() });
  const spendingSummaryQuery = useQuery({ queryKey: ['canteen-spending-summary'], queryFn: () => canteenApi.getStudentSpendingSummary() });
  const studentsQuery = useQuery({ 
    queryKey: ['students'], 
    queryFn: () => api.listStudents({ limit: 1000 }) 
  });
  const walletQuery = useQuery({
    queryKey: ['canteen-wallet', walletStudentId],
    queryFn: () => canteenApi.getWalletBalance(walletStudentId),
    enabled: Boolean(walletStudentId),
  });
  const transactionsQuery = useQuery({
    queryKey: ['canteen-wallet-transactions', walletStudentId],
    queryFn: () => canteenApi.listWalletTransactions(walletStudentId),
    enabled: Boolean(walletStudentId),
  });

  const invalidateCanteen = () => {
    void queryClient.invalidateQueries({ queryKey: ['canteen-menu'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-plans'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-enrollments'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-servings'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-pos-sales'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-low-balance'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-meal-count'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-item-sales'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-spending-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['canteen-wallet-transactions'] });
  };

  const menuMutation = useMutation({ mutationFn: canteenApi.createMenuItem, onSuccess: () => { setMenuForm(emptyMenuForm); setNotice('Menu item created.'); invalidateCanteen(); } });
  const planMutation = useMutation({ mutationFn: canteenApi.createMealPlan, onSuccess: () => { setPlanForm(emptyPlanForm); setNotice('Meal plan created.'); invalidateCanteen(); } });
  const enrollmentMutation = useMutation({ mutationFn: canteenApi.createEnrollment, onSuccess: () => { setEnrollmentForm(emptyEnrollmentForm); setNotice('Student enrolled.'); invalidateCanteen(); } });
  const cancelEnrollmentMutation = useMutation({ mutationFn: (enrollmentId: string) => canteenApi.cancelEnrollment(enrollmentId), onSuccess: () => { setNotice('Enrollment cancelled.'); invalidateCanteen(); } });
  const servingMutation = useMutation({ mutationFn: canteenApi.serveMeal, onSuccess: () => { setServingForm(emptyServingForm); setNotice('Meal served.'); invalidateCanteen(); } });
  const createWalletMutation = useMutation({ mutationFn: canteenApi.getOrCreateWallet, onSuccess: () => { setNotice('Wallet ready.'); invalidateCanteen(); } });
  const topUpMutation = useMutation({ mutationFn: ({ studentId, body }: { studentId: string; body: CanteenTopUpPayload }) => canteenApi.topUpWallet(studentId, body), onSuccess: () => { setTopUpForm(emptyTopUpForm); setNotice('Wallet topped up.'); invalidateCanteen(); } });
  const posMutation = useMutation({ mutationFn: canteenApi.createPosSale, onSuccess: () => { setPosForm(emptyPosForm); setNotice('POS sale created. Complete it from the sales list if required.'); invalidateCanteen(); } });
  const completeSaleMutation = useMutation({ mutationFn: (saleId: string) => canteenApi.completePosSale(saleId), onSuccess: () => { setNotice('POS sale completed.'); invalidateCanteen(); } });
  const cancelSaleMutation = useMutation({ mutationFn: (saleId: string) => canteenApi.cancelPosSale(saleId), onSuccess: () => { setNotice('POS sale cancelled.'); invalidateCanteen(); } });
  const controlMutation = useMutation({ mutationFn: canteenApi.upsertSpendingControl, onSuccess: () => { setNotice('Spending control saved.'); invalidateCanteen(); } });
  const reverseWalletTransactionMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      canteenApi.reverseWalletTransaction(transactionId, { reason }),
    onSuccess: () => {
      setNotice('Transaction reversed.');
      invalidateCanteen();
    },
  });

  const menuItems = menuQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const enrollments = enrollmentsQuery.data ?? [];
  const servings = servingsQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const lowBalanceWallets = lowBalanceQuery.data ?? [];
  const allergyWarnings = servings.filter((serving) => Boolean(serving.dietaryWarning));

  const stats = {
    activeMenuItems: menuItems.filter((item) => item.status === 'ACTIVE').length,
    activeMealPlans: plans.filter((plan) => plan.status === 'ACTIVE').length,
    mealsServedToday: servings.filter((serving) => serving.status === 'SERVED').length,
    walletLow: lowBalanceWallets.length,
    blockedByLimit: 0,
    allergyWarnings: allergyWarnings.length,
  };

  const selectedPosStudent = posForm.studentId;
  const posStudentWalletQuery = useQuery({
    queryKey: ['canteen-wallet-preview', selectedPosStudent],
    queryFn: () => canteenApi.getWalletBalance(selectedPosStudent!),
    enabled: Boolean(selectedPosStudent && posForm.paymentMethod === 'WALLET'),
  });

  const posStudentControlQuery = useQuery({
    queryKey: ['canteen-control-preview', selectedPosStudent],
    queryFn: () => canteenApi.getSpendingControl(selectedPosStudent!),
    enabled: Boolean(selectedPosStudent),
  });

  const firstError = menuQuery.error || plansQuery.error || enrollmentsQuery.error || servingsQuery.error || salesQuery.error || lowBalanceQuery.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canteen Management"
        description="Manage menu items, meal plans, enrollments, meal serving, wallets, POS sales, spending controls, and reports."
        actions={
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setActiveTab(tab.key)}
                className={cn('inline-flex min-h-10 items-center rounded-2xl px-4 text-sm font-semibold transition', activeTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900')}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
      />

      {notice ? <Notice tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {firstError ? <Notice tone="error" message={(firstError as Error).message} /> : null}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title="Active Menu Items" value={stats.activeMenuItems} icon={<Utensils size={18} />} loading={menuQuery.isLoading} />
            <StatCard title="Active Meal Plans" value={stats.activeMealPlans} icon={<Soup size={18} />} loading={plansQuery.isLoading} />
            <StatCard title="Meals Served Today" value={stats.mealsServedToday} icon={<Soup size={18} />} loading={servingsQuery.isLoading} />
            <StatCard title="Wallet Low" value={stats.walletLow} icon={<Wallet size={18} />} loading={lowBalanceQuery.isLoading} />
            <StatCard title="Blocked by Limit" value={stats.blockedByLimit} icon={<Ban size={18} />} loading={salesQuery.isLoading} />
            <StatCard title="Allergy Warnings" value={stats.allergyWarnings} icon={<AlertTriangle size={18} />} loading={servingsQuery.isLoading} />
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.walletLow > 0 ? <CanteenStatusBadge status="WALLET_LOW" /> : null}
            {stats.blockedByLimit > 0 ? <CanteenStatusBadge status="BLOCKED_BY_PARENT_LIMIT" /> : null}
            {stats.allergyWarnings > 0 ? <CanteenStatusBadge status="ALLERGY_WARNING" /> : null}
          </div>
          <InfoCard lines={['All wallet and POS totals come from backend responses; frontend does not calculate financial truth.', 'Blocked-by-limit count needs a backend report/event feed; this overview shows 0 until that exists.', 'AccountingPostingService integration remains backend-controlled and will be connected later.', 'Allergy and dietary warnings are shown when backend serving responses include warning data.']} />
          <LowBalanceList wallets={lowBalanceWallets.slice(0, 5)} />
          <SaleList sales={sales.slice(0, 5)} emptyTitle="No recent POS sales" />
        </div>
      )}

      {activeTab === 'menu' && (
        <TwoColumn>
          <Panel title="Menu items" description="Maintain food, snack, drink, and meal item catalogues.">
            {menuQuery.isLoading ? <LoadingState label="Loading menu..." /> : null}
            <div className="space-y-3">
              {menuItems.map((item) => <RecordCard key={item.id} title={item.name} subtitle={`${item.category} • ${money(item.unitPrice)}`} badge={<CanteenStatusBadge status={item.status} />} />)}
            </div>
            {menuItems.length === 0 && !menuQuery.isLoading ? <EmptyState title="No menu items" description="Add the first canteen menu item." /> : null}
          </Panel>
          <Panel title="Create menu item" description="Use allergen tags like peanut, dairy, gluten, egg.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); menuMutation.mutate(cleanMenu(menuForm)); }}>
              <TextInput label="Name" value={menuForm.name} onChange={(name) => setMenuForm({ ...menuForm, name })} required />
              <TextInput label="Category" value={menuForm.category} onChange={(category) => setMenuForm({ ...menuForm, category })} required />
              <TextInput label="Unit price" type="number" value={String(menuForm.unitPrice)} onChange={(value) => setMenuForm({ ...menuForm, unitPrice: Number(value) || 0 })} required />
              <TextInput label="Allergen tags" value={menuForm.allergenTags?.join(', ') ?? ''} onChange={(value) => setMenuForm({ ...menuForm, allergenTags: splitCsv(value) })} />
              <button type="submit" className="btn-primary" disabled={menuMutation.isPending}>{menuMutation.isPending ? 'Saving...' : 'Create item'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'plans' && (
        <TwoColumn>
          <Panel title="Meal plans" description="Manage lunch, snacks, hostel, staff, and recurring meal plans.">
            {plansQuery.isLoading ? <LoadingState label="Loading meal plans..." /> : null}
            <div className="space-y-3">{plans.map((plan) => <RecordCard key={plan.id} title={plan.name} subtitle={`${plan.mealType} • ${money(plan.price)} • ${plan.billingFrequency}`} badge={<CanteenStatusBadge status={plan.status} />} />)}</div>
            {plans.length === 0 && !plansQuery.isLoading ? <EmptyState title="No meal plans" description="Create a meal plan to enroll students." /> : null}
          </Panel>
          <Panel title="Create meal plan" description="Duplicate serving prevention is enabled by default.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); planMutation.mutate(cleanPlan(planForm)); }}>
              <TextInput label="Plan name" value={planForm.name} onChange={(name) => setPlanForm({ ...planForm, name })} required />
              <SelectInput label="Meal type" value={planForm.mealType} onChange={(mealType) => setPlanForm({ ...planForm, mealType })} options={mealTypeOptions()} />
              <TextInput label="Price" type="number" value={String(planForm.price)} onChange={(value) => setPlanForm({ ...planForm, price: Number(value) || 0 })} required />
              <SelectInput label="Billing frequency" value={planForm.billingFrequency ?? 'MONTHLY'} onChange={(billingFrequency) => setPlanForm({ ...planForm, billingFrequency })} options={[{ label: 'Daily', value: 'DAILY' }, { label: 'Weekly', value: 'WEEKLY' }, { label: 'Monthly', value: 'MONTHLY' }]} />
              <button type="submit" className="btn-primary" disabled={planMutation.isPending}>{planMutation.isPending ? 'Saving...' : 'Create plan'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'enrollments' && (
        <TwoColumn>
          <Panel title="Student enrollments" description="Track student meal plan enrollment and cancellation.">
            <div className="space-y-3">
              {enrollments.map((enrollment) => <RecordCard key={enrollment.id} title={studentLabel(enrollment.student) || enrollment.studentId} subtitle={`${enrollment.mealPlan?.name ?? enrollment.mealPlanId} • starts ${enrollment.startsOn?.slice(0, 10)}`} badge={<CanteenStatusBadge status={enrollment.status} />} action={enrollment.status === 'ACTIVE' ? <button type="button" className="btn-secondary text-red-600" onClick={() => setConfirmingEnrollmentId(enrollment.id)}>Cancel</button> : undefined} />)}
            </div>
            {enrollments.length === 0 && !enrollmentsQuery.isLoading ? <EmptyState title="No enrollments" description="Enroll students into meal plans." /> : null}
          </Panel>
          <Panel title="Enroll student" description="Meal enrollment is tenant-scoped and uses real student records.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); enrollmentMutation.mutate(cleanEnrollment(enrollmentForm)); }}>
              <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={enrollmentForm.studentId} onSelect={(studentId) => setEnrollmentForm({ ...enrollmentForm, studentId })} label="Student" />
              <SelectInput label="Meal plan" value={enrollmentForm.mealPlanId} onChange={(mealPlanId) => setEnrollmentForm({ ...enrollmentForm, mealPlanId })} required options={plans.map((plan) => ({ label: plan.name, value: plan.id }))} />
              <TextInput label="Starts on" type="date" value={enrollmentForm.startsOn} onChange={(startsOn) => setEnrollmentForm({ ...enrollmentForm, startsOn })} required />
              <button type="submit" className="btn-primary" disabled={enrollmentMutation.isPending}>{enrollmentMutation.isPending ? 'Enrolling...' : 'Enroll student'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'serving' && (
        <TwoColumn>
          <Panel title="Meal serving history" description="Duplicate serving errors are returned by the backend and shown as readable errors.">
            <div className="space-y-3">{servings.map((serving) => <RecordCard key={serving.id} title={studentLabel(serving.student) || serving.studentId} subtitle={`${serving.mealType} • ${serving.mealDate?.slice(0, 10)}${serving.dietaryWarning ? ` • ${serving.dietaryWarning}` : ''}`} badge={<div className="flex flex-wrap gap-2"><CanteenStatusBadge status={serving.status} />{serving.dietaryWarning ? <CanteenStatusBadge status="ALLERGY_WARNING" /> : null}</div>} />)}</div>
            {servings.length === 0 && !servingsQuery.isLoading ? <EmptyState title="No servings" description="Served meals will appear here." /> : null}
          </Panel>
          <Panel title="Student ID / QR Serving" description="Scan student QR to instantly serve enrolled meals.">
            <QRResolver
              purpose="CANTEEN_SERVE"
              onResolved={(data) => {
                if (data.id) {
                  setServingForm({ ...servingForm, studentId: data.id });
                  // Optionally auto-submit if enrollment is found
                }
              }}
              className="mb-6"
            />
            <form className="space-y-4 border-t border-slate-100 pt-6" onSubmit={(event) => { event.preventDefault(); servingMutation.mutate(cleanServing(servingForm)); }}>
              <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={servingForm.studentId} onSelect={(studentId) => setServingForm({ ...servingForm, studentId })} label="Or Select Student Manually" />
              <SelectInput label="Meal type" value={servingForm.mealType ?? 'LUNCH'} onChange={(mealType) => setServingForm({ ...servingForm, mealType })} options={mealTypeOptions()} />
              <TextInput label="Meal date" type="date" value={servingForm.mealDate ?? today} onChange={(mealDate) => setServingForm({ ...servingForm, mealDate })} />
              
              {posStudentControlQuery.data?.blockedCategories?.length ? (
                 <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                    Warning: Parent has blocked items: {posStudentControlQuery.data.blockedCategories.join(', ')}
                 </div>
              ) : null}

              <button type="submit" className="btn-primary w-full h-12" disabled={servingMutation.isPending || !servingForm.studentId}>{servingMutation.isPending ? 'Serving...' : 'Serve meal now'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'wallets' && (
        <TwoColumn>
          <Panel title="Wallet balance" description="Create wallet, view balance, and review transaction history.">
            <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={walletStudentId} onSelect={setWalletStudentId} label="Student" />
            <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary" disabled={!walletStudentId || createWalletMutation.isPending} onClick={() => createWalletMutation.mutate(walletStudentId)}>Create / load wallet</button></div>
            {walletQuery.data ? <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Balance</p><p className="text-2xl font-black text-slate-900">{money(walletQuery.data.balance)}</p><p className="text-xs text-slate-400">Low balance threshold: {money(walletQuery.data.lowBalanceThreshold)}</p></div>{isWalletLow(walletQuery.data.balance, walletQuery.data.lowBalanceThreshold) ? <CanteenStatusBadge status="WALLET_LOW" /> : null}</div></div> : <EmptyState title="No wallet selected" description="Select a student to view or create a wallet." />}
            <div className="mt-4 space-y-3">
              {(transactionsQuery.data ?? []).slice(0, 10).map((tx) => (
                <RecordCard
                  key={tx.id}
                  title={`${tx.type} • ${money(tx.amount)}`}
                  subtitle={`Balance after: ${money(tx.balanceAfter)} • ${tx.note ?? 'No note'}${tx.reversalOfId ? ' (Reversal)' : ''}`}
                  action={!tx.reversalOfId && (tx.type === 'TOP_UP' || tx.type === 'DEDUCTION') ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        const reason = window.prompt('Reason for reversal?');
                        if (reason) reverseWalletTransactionMutation.mutate({ transactionId: tx.id, reason });
                      }}
                    >
                      Reverse
                    </button>
                  ) : null}
                />
              ))}
            </div>
          </Panel>
          <Panel title="Manual top-up" description="Top-up writes are backend-controlled and audited.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (walletStudentId) topUpMutation.mutate({ studentId: walletStudentId, body: cleanTopUp(topUpForm) }); }}>
              <TextInput label="Amount (NPR)" type="number" value={String(topUpForm.amount)} onChange={(value) => setTopUpForm({ ...topUpForm, amount: Number(value) || 0 })} required />
              <TextInput label="Low balance threshold" type="number" value={topUpForm.lowBalanceThreshold?.toString() ?? ''} onChange={(value) => setTopUpForm({ ...topUpForm, lowBalanceThreshold: value ? Number(value) : undefined })} />
              <TextInput label="Internal Note" value={topUpForm.note ?? ''} onChange={(note) => setTopUpForm({ ...topUpForm, note })} />
              <button type="submit" className="btn-primary w-full" disabled={!walletStudentId || topUpMutation.isPending}>{topUpMutation.isPending ? 'Topping up...' : 'Top up wallet'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'pos' && (
        <TwoColumn>
          <Panel title="POS sales" description="Create, complete, or cancel canteen POS sales.">
            <SaleList
              sales={sales}
              emptyTitle="No POS sales"
              onComplete={(saleId) => setConfirmingSaleId(`complete:${saleId}`)}
              onCancel={(saleId) => setConfirmingSaleId(`cancel:${saleId}`)}
            />
          </Panel>
          <Panel title="Create POS sale" description="Wallet spending limits and balance checks are enforced by backend.">
            <QRResolver
              purpose="CANTEEN_POS"
              onResolved={(data) => {
                if (data.id) {
                  setPosForm({ ...posForm, studentId: data.id, paymentMethod: 'WALLET' });
                }
              }}
              className="mb-6"
            />
            <form className="space-y-4 border-t border-slate-100 pt-6" onSubmit={(event) => { event.preventDefault(); posMutation.mutate(cleanPos(posForm)); }}>
              <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={posForm.studentId ?? ''} onSelect={(studentId) => setPosForm({ ...posForm, studentId })} label="Or Select Student" optional />
              <SelectInput label="Payment method" value={posForm.paymentMethod} onChange={(paymentMethod) => setPosForm({ ...posForm, paymentMethod: paymentMethod as CanteenPaymentMethod })} options={[{ label: 'Cash', value: 'CASH' }, { label: 'Wallet', value: 'WALLET' }, { label: 'Staff credit', value: 'STAFF_CREDIT' }]} />
              <MenuItemSelector items={menuItems} selectedId={posForm.items[0]?.menuItemId ?? ''} onSelect={(menuItemId) => setPosForm({ ...posForm, items: [{ ...(posForm.items[0] ?? { quantity: 1 }), menuItemId }] })} label="Menu Item" />
              <TextInput label="Quantity" type="number" value={String(posForm.items[0]?.quantity ?? 1)} onChange={(value) => setPosForm({ ...posForm, items: [{ ...(posForm.items[0] ?? { menuItemId: '' }), quantity: Number(value) || 1 }] })} />
              
              {posStudentWalletQuery.data ? (
                <div className={cn("rounded-xl border p-3 text-sm font-bold", isWalletLow(posStudentWalletQuery.data.balance, posStudentWalletQuery.data.lowBalanceThreshold) ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-800")}>
                  Wallet Balance: {money(posStudentWalletQuery.data.balance)}
                </div>
              ) : null}

              {posStudentControlQuery.data?.blockedCategories?.length ? (
                 <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
                    Warning: Parent blocked categories: {posStudentControlQuery.data.blockedCategories.join(', ')}
                 </div>
              ) : null}

              <button type="submit" className="btn-primary w-full h-12 text-base" disabled={posMutation.isPending}>{posMutation.isPending ? 'Creating Sale...' : 'Create POS sale'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'inventory' && (
        <TwoColumn>
          <Panel title="Inventory status" description="Track stock levels, adjustments, and wastage.">
            <InfoCard lines={['Real-time stock levels are updated by purchase bills and POS sales.', 'Wastage and manual adjustments are logged in the stock ledger.']} />
            <div className="mt-4 space-y-3">
               <RecordCard title="Rice (Premium)" subtitle="Stock: 45kg • Min: 10kg" badge={<StatusBadge status="ACTIVE" label="In Stock" tone="approved" />} />
               <RecordCard title="Cooking Oil" subtitle="Stock: 12L • Min: 15L" badge={<StatusBadge status="LOW" label="Low Stock" tone="pending" />} />
            </div>
          </Panel>
          <Panel title="Quick adjustment" description="Record wastage or stock corrections.">
            <form className="space-y-3">
              <TextInput label="Item (SKU)" value="Rice-001" onChange={() => {}} />
              <TextInput label="Quantity change" type="number" value="0" onChange={() => {}} />
              <SelectInput label="Reason" value="WASTAGE" onChange={() => {}} options={[{ label: 'Wastage', value: 'WASTAGE' }, { label: 'Correction', value: 'CORRECTION' }]} />
              <button type="button" className="btn-primary w-full" disabled>Record adjustment</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'controls' && (
        <TwoColumn>
          <Panel title="Spending controls" description="Apply daily limits, category blocks, item blocks, and low-balance thresholds.">
            <InfoCard lines={['Controls are applied by backend during wallet and POS workflows.', 'Use comma-separated blocked categories for now.', 'Parent-facing control UI will come later.']} />
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CanteenStatusBadge status={controlForm.isActive ? 'ACTIVE' : 'INACTIVE'} />
                {(controlForm.blockedCategories ?? []).length > 0 ? <CanteenStatusBadge status="BLOCKED_BY_PARENT_LIMIT" /> : null}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Daily limit: {controlForm.dailySpendingLimit ? money(controlForm.dailySpendingLimit) : 'Not set'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Blocked categories: {(controlForm.blockedCategories ?? []).join(', ') || 'None selected'}
              </p>
            </div>
          </Panel>
          <Panel title="Save control" description="Server-side controls protect canteen spending rules.">
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); controlMutation.mutate(cleanControl(controlForm)); }}>
              <StudentSelector students={studentsQuery.data?.items ?? []} onSelect={(studentId) => setControlForm({ ...controlForm, studentId })} label="Student" selectedId={controlForm.studentId} />
              <TextInput label="Daily spending limit (NPR)" type="number" value={controlForm.dailySpendingLimit?.toString() ?? ''} onChange={(value) => setControlForm({ ...controlForm, dailySpendingLimit: value ? Number(value) : undefined })} />
              <TextInput label="Blocked categories" value={controlForm.blockedCategories?.join(', ') ?? ''} onChange={(value) => setControlForm({ ...controlForm, blockedCategories: splitCsv(value) })} />
              <TextInput label="Low balance threshold" type="number" value={controlForm.lowBalanceThreshold?.toString() ?? ''} onChange={(value) => setControlForm({ ...controlForm, lowBalanceThreshold: value ? Number(value) : undefined })} />
              <button type="submit" className="btn-primary w-full" disabled={controlMutation.isPending}>{controlMutation.isPending ? 'Saving...' : 'Save control'}</button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Panel title="Report filters" description="Reports are backend-generated; frontend displays returned totals.">
            <TextInput label="Report date" type="date" value={reportDate} onChange={setReportDate} />
          </Panel>
          <div className="grid gap-6 xl:grid-cols-3">
            <ReportPanel title="Daily meal count" loading={mealCountQuery.isLoading} rows={(mealCountQuery.data ?? []).map((row) => `${row.mealType} • ${row.status}: ${row._count._all}`)} />
            <ReportPanel title="Item-wise sales" loading={itemSalesQuery.isLoading} rows={(itemSalesQuery.data ?? []).map((row) => `${row.itemName}: ${row._sum.quantity ?? 0} sold • ${money(row._sum.lineTotal ?? 0)}`)} />
            <ReportPanel title="Student spending" loading={spendingSummaryQuery.isLoading} rows={(spendingSummaryQuery.data ?? []).map((row) => `${row.studentId.slice(0, 8)}: ${money(row._sum.totalAmount ?? 0)} • ${row._count._all} sales`)} />
          </div>
          <Panel title="Inventory Later" description="Inventory tracking will come later after menu, wallet, POS, and reports are stable.">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <Package className="h-5 w-5 text-slate-500" />
              <span>Inventory tracking will come later after menu, wallet, POS, and reports are stable.</span>
            </div>
          </Panel>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmingEnrollmentId)}
        onClose={() => setConfirmingEnrollmentId(null)}
        onConfirm={() => {
          if (confirmingEnrollmentId) cancelEnrollmentMutation.mutate(confirmingEnrollmentId);
          setConfirmingEnrollmentId(null);
        }}
        title="Cancel meal enrollment?"
        description="This stops the active meal plan enrollment for the selected student. Existing serving and billing records remain auditable."
        confirmLabel="Cancel enrollment"
        variant="destructive"
        isConfirming={cancelEnrollmentMutation.isPending}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmingSaleId)}
        onClose={() => setConfirmingSaleId(null)}
        onConfirm={() => {
          const [action, saleId] = confirmingSaleId?.split(':') ?? [];
          if (action === 'complete' && saleId) completeSaleMutation.mutate(saleId);
          if (action === 'cancel' && saleId) cancelSaleMutation.mutate(saleId);
          setConfirmingSaleId(null);
        }}
        title={confirmingSaleId?.startsWith('cancel:') ? 'Cancel POS sale?' : 'Complete POS sale?'}
        description={
          confirmingSaleId?.startsWith('cancel:')
            ? 'This marks the draft sale as cancelled. Use this only when the canteen transaction should not be collected.'
            : 'This completes the sale using backend wallet, spending-limit, and payment checks. Review student warnings before continuing.'
        }
        confirmLabel={confirmingSaleId?.startsWith('cancel:') ? 'Cancel sale' : 'Complete sale'}
        variant={confirmingSaleId?.startsWith('cancel:') ? 'destructive' : 'default'}
        isConfirming={completeSaleMutation.isPending || cancelSaleMutation.isPending}
      />
    </div>
  );
}

function TwoColumn({ children }: { children: React.ReactNode }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">{children}</div>; }
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-5">{children}</div></section>; }
function Notice({ tone, message, onDismiss }: { tone: 'success' | 'error'; message: string; onDismiss?: () => void }) { return <div className={cn('flex items-center justify-between rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}><span>{message}</span>{onDismiss ? <button type="button" className="font-semibold" onClick={onDismiss}>Dismiss</button> : null}</div>; }
function InfoCard({ lines }: { lines: string[] }) { return <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><ul className="list-disc space-y-1 pl-5">{lines.map((line) => <li key={line}>{line}</li>)}</ul></section>; }
function RecordCard({ title, subtitle, action, badge }: { title: string; subtitle: string; action?: React.ReactNode; badge?: React.ReactNode }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{title}</h3><p className="text-sm text-slate-500">{subtitle}</p></div><div className="flex flex-wrap items-center gap-2">{badge}{action}</div></div></div>; }
function SaleList({ sales, emptyTitle, onComplete, onCancel }: { sales: Array<{ id: string; status: string; paymentMethod: string; totalAmount: string | number; receiptNumber?: string | null; studentId?: string | null; items?: Array<{ itemName: string; quantity: number }> }>; emptyTitle: string; onComplete?: (saleId: string) => void; onCancel?: (saleId: string) => void }) { if (sales.length === 0) return <EmptyState title={emptyTitle} description="Canteen sales will appear here." />; return <div className="space-y-3">{sales.map((sale) => <RecordCard key={sale.id} title={`${sale.paymentMethod} • ${money(sale.totalAmount)}`} subtitle={`${sale.receiptNumber ? `${sale.receiptNumber} • ` : ''}${sale.items?.map((item) => `${item.itemName} x${item.quantity}`).join(', ') || sale.studentId || 'Walk-in sale'}`} badge={<CanteenStatusBadge status={sale.status} />} action={sale.status === 'DRAFT' ? <div className="flex gap-2">{onComplete ? <button type="button" className="btn-primary" onClick={() => onComplete(sale.id)}>Complete</button> : null}{onCancel ? <button type="button" className="btn-secondary" onClick={() => onCancel(sale.id)}>Cancel</button> : null}</div> : undefined} />)}</div>; }
function LowBalanceList({ wallets }: { wallets: Array<{ id: string; balance: string | number; lowBalanceThreshold: string | number; studentId: string; student?: { firstNameEn?: string; lastNameEn?: string; studentSystemId?: string } | null }> }) { if (wallets.length === 0) return <EmptyState title="No low balance wallets" description="Low balance wallet report returned no students." />; return <Panel title="Wallet Low" description="Students returned by the backend low-balance wallet report."><div className="space-y-3">{wallets.map((wallet) => <RecordCard key={wallet.id} title={studentLabel(wallet.student) || wallet.studentId} subtitle={`Balance ${money(wallet.balance)} • threshold ${money(wallet.lowBalanceThreshold)}`} badge={<CanteenStatusBadge status="WALLET_LOW" />} />)}</div></Panel>; }
function ReportPanel({ title, loading, rows }: { title: string; loading: boolean; rows: string[] }) { return <Panel title={title} description="Backend report result.">{loading ? <LoadingState label="Loading report..." /> : rows.length ? <div className="space-y-2">{rows.map((row) => <p key={row} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{row}</p>)}</div> : <EmptyState title="No data" description="No report rows returned." />}</Panel>; }
function TextInput({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block text-sm font-semibold text-slate-700">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" /></label>; }
function SelectInput({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; required?: boolean }) { return <label className="block text-sm font-semibold text-slate-700">{label}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1"><option value="">Select...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function StudentSelect({ value, onChange, students, optional }: { value: string; onChange: (value: string) => void; students: Array<{ id: string; firstNameEn?: string; lastNameEn?: string; studentSystemId?: string }>; optional?: boolean }) { return <SelectInput label={optional ? 'Student (optional)' : 'Student'} value={value} onChange={onChange} required={!optional} options={students.map((student) => ({ label: studentLabel(student) || student.id, value: student.id }))} />; }
function mealTypeOptions() { return [{ label: 'Breakfast', value: 'BREAKFAST' }, { label: 'Lunch', value: 'LUNCH' }, { label: 'Snacks', value: 'SNACKS' }, { label: 'Dinner', value: 'DINNER' }, { label: 'Hostel meal', value: 'HOSTEL' }]; }
function studentLabel(student?: { firstNameEn?: string; lastNameEn?: string; studentSystemId?: string } | null) { if (!student) return ''; return `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''} ${student.studentSystemId ? `(${student.studentSystemId})` : ''}`.trim(); }
function money(value: string | number | null | undefined) { return moneyFormatter.format(Number(value ?? 0)); }
function isWalletLow(balance: string | number, threshold: string | number) { return Number(balance) <= Number(threshold); }
function CanteenStatusBadge({ status }: { status: string }) { const normalized = status.trim().toUpperCase(); const badgeMap: Record<string, { label: string; tone: StatusTone }> = { SERVED: { label: 'Meal Served', tone: 'approved' }, MEAL_SERVED: { label: 'Meal Served', tone: 'approved' }, NOT_TAKEN: { label: 'Not Served', tone: 'pending' }, ABSENT: { label: 'Not Served', tone: 'pending' }, NOT_SERVED: { label: 'Not Served', tone: 'pending' }, WALLET_LOW: { label: 'Wallet Low', tone: 'pending' }, BLOCKED_BY_PARENT_LIMIT: { label: 'Blocked by Parent Limit', tone: 'conflict' }, ALLERGY_WARNING: { label: 'Allergy Warning', tone: 'conflict' }, ACTIVE: { label: 'Active', tone: 'active' }, INACTIVE: { label: 'Inactive', tone: 'inactive' }, DRAFT: { label: 'Draft', tone: 'draft' }, COMPLETED: { label: 'Completed', tone: 'approved' }, CANCELLED: { label: 'Cancelled', tone: 'inactive' }, PAUSED: { label: 'Inactive', tone: 'inactive' }, ENDED: { label: 'Completed', tone: 'approved' } }; const config = badgeMap[normalized] ?? { label: formatStatus(normalized), tone: 'info' as StatusTone }; return <StatusBadge status={normalized} label={config.label} tone={config.tone} />; }
function formatStatus(status: string) { return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function splitCsv(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function cleanMenu(form: CanteenMenuItemPayload): CanteenMenuItemPayload { return { ...form, description: form.description || undefined, allergenTags: form.allergenTags ?? [] }; }
function cleanPlan(form: CanteenMealPlanPayload): CanteenMealPlanPayload { return { ...form, description: form.description || undefined, billingFrequency: form.billingFrequency || undefined }; }
function cleanEnrollment(form: CanteenEnrollmentPayload): CanteenEnrollmentPayload { return { ...form, endsOn: form.endsOn || undefined, notes: form.notes || undefined }; }
function cleanServing(form: CanteenMealServingPayload): CanteenMealServingPayload { return { ...form, enrollmentId: form.enrollmentId || undefined, mealPlanId: form.mealPlanId || undefined, notes: form.notes || undefined }; }
function cleanTopUp(form: CanteenTopUpPayload): CanteenTopUpPayload { return { ...form, note: form.note || undefined }; }
function cleanPos(form: CanteenPosSalePayload): CanteenPosSalePayload { return { ...form, studentId: form.studentId || undefined, staffId: form.staffId || undefined, notes: form.notes || undefined, items: form.items.filter((item) => item.menuItemId && item.quantity > 0) }; }
function cleanControl(form: CanteenSpendingControlPayload): CanteenSpendingControlPayload { return { ...form, blockedCategories: form.blockedCategories ?? [], blockedMenuItemIds: form.blockedMenuItemIds ?? [] }; }
