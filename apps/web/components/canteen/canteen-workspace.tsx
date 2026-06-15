'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Download, Package, QrCode, Soup, Utensils, Wallet } from 'lucide-react';
import type { StudentProfile } from '@schoolos/core';
import { api } from '../../lib/api';
import { canteenApi, type CanteenEnrollmentPayload, type CanteenInventoryItemPayload, type CanteenMealPlanPayload, type CanteenMealServingPayload, type CanteenMenuItemPayload, type CanteenPaymentMethod, type CanteenPosReceipt, type CanteenPosSalePayload, type CanteenPurchaseBillPayload, type CanteenSpendingControlPayload, type CanteenStockAdjustmentPayload, type CanteenSupplierPayload, type CanteenTopUpPayload, type CanteenWastagePayload } from '../../lib/canteen-api';
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

type CanteenQrStudent = {
  id?: string;
  studentId?: string;
  name?: string;
  studentCode?: string;
  classSection?: string;
  walletBalance?: string | number | null;
  walletStatus?: string | null;
  allergyWarnings?: string[];
  spendingWarnings?: string | null;
  canPurchase?: boolean;
};

const tabs: Array<{ key: CanteenTab; label: string; href: string }> = [
  { key: 'overview', label: 'Overview', href: '/dashboard/canteen' },
  { key: 'menu', label: 'Menu', href: '/dashboard/canteen/menu' },
  { key: 'plans', label: 'Meal Plans', href: '/dashboard/canteen/plans' },
  {
    key: 'enrollments',
    label: 'Enrollments',
    href: '/dashboard/canteen/enrollments',
  },
  { key: 'serving', label: 'Serving', href: '/dashboard/canteen/serving' },
  { key: 'wallets', label: 'Wallets', href: '/dashboard/canteen/wallets' },
  { key: 'pos', label: 'POS', href: '/dashboard/canteen/pos' },
  { key: 'controls', label: 'Controls', href: '/dashboard/canteen/controls' },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/dashboard/canteen/inventory',
  },
  { key: 'reports', label: 'Reports', href: '/dashboard/canteen/reports' },
];

const today = new Date().toISOString().slice(0, 10);
const servingAllergyAcknowledgementLabel =
  "I reviewed this student's allergy and medical warnings before";

const emptyMenuForm: CanteenMenuItemPayload = {
  name: '',
  category: '',
  unitPrice: 0,
  isMealItem: true,
  allergenTags: [],
};
const emptyPlanForm: CanteenMealPlanPayload = {
  name: '',
  mealType: 'LUNCH',
  price: 0,
  billingFrequency: 'MONTHLY',
  duplicateServingPrevention: true,
};
const emptyEnrollmentForm: CanteenEnrollmentPayload = {
  studentId: '',
  mealPlanId: '',
  startsOn: today,
};
const emptyServingForm: CanteenMealServingPayload = {
  studentId: '',
  mealType: 'LUNCH',
  mealDate: today,
  preventDuplicate: true,
};
const emptyTopUpForm: CanteenTopUpPayload = {
  amount: 100,
  note: '',
  lowBalanceThreshold: 100,
};
const emptyPosForm: CanteenPosSalePayload = {
  studentId: '',
  paymentMethod: 'CASH',
  items: [{ menuItemId: '', quantity: 1 }],
};
const emptyControlForm: CanteenSpendingControlPayload = {
  studentId: '',
  isActive: true,
};
const emptySupplierForm: CanteenSupplierPayload = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  panNumber: '',
};
const emptyInventoryItemForm: CanteenInventoryItemPayload = {
  name: '',
  sku: '',
  category: '',
  unit: 'pcs',
  minStockLevel: 0,
  unitCost: 0,
  defaultSupplierId: '',
};
const emptyPurchaseBillForm: CanteenPurchaseBillPayload = {
  supplierId: '',
  billNumber: '',
  billDate: today,
  taxAmount: 0,
  discountAmount: 0,
  notes: '',
  items: [
    {
      inventoryItemId: '',
      quantity: 1,
      unitCost: 0,
      expiryDate: '',
      batchNumber: '',
    },
  ],
};
const emptyWastageForm: CanteenWastagePayload = {
  inventoryItemId: '',
  quantity: 1,
  reason: '',
  wastageDate: today,
  notes: '',
};
const emptyStockAdjustmentForm: CanteenStockAdjustmentPayload = {
  inventoryItemId: '',
  quantity: 1,
  reason: '',
};

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

function optionalNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

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
  const [supplierForm, setSupplierForm] = useState<CanteenSupplierPayload>(emptySupplierForm);
  const [inventoryItemForm, setInventoryItemForm] = useState<CanteenInventoryItemPayload>(emptyInventoryItemForm);
  const [purchaseBillForm, setPurchaseBillForm] = useState<CanteenPurchaseBillPayload>(emptyPurchaseBillForm);
  const [wastageForm, setWastageForm] = useState<CanteenWastagePayload>(emptyWastageForm);
  const [stockAdjustmentForm, setStockAdjustmentForm] = useState<CanteenStockAdjustmentPayload>(emptyStockAdjustmentForm);
  const [reportDate, setReportDate] = useState(today);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);
  const [confirmingEnrollmentId, setConfirmingEnrollmentId] = useState<string | null>(null);
  const [walletReversal, setWalletReversal] = useState<{ transactionId: string; label: string } | null>(null);
  const [walletReversalReason, setWalletReversalReason] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<CanteenPosReceipt | null>(null);
  const [resolvedServingStudent, setResolvedServingStudent] = useState<CanteenQrStudent | null>(null);
  const [resolvedPosStudent, setResolvedPosStudent] = useState<CanteenQrStudent | null>(null);
  const [servingAllergyAcknowledged, setServingAllergyAcknowledged] =
    useState(false);

  const queryClient = useQueryClient();
  const menuQuery = useQuery({
    queryKey: ['canteen-menu'],
    queryFn: () => canteenApi.listMenuItems({ status: '' }),
  });
  const plansQuery = useQuery({
    queryKey: ['canteen-plans'],
    queryFn: () => canteenApi.listMealPlans({ status: '' }),
  });
  const enrollmentsQuery = useQuery({
    queryKey: ['canteen-enrollments'],
    queryFn: () => canteenApi.listEnrollments(),
  });
  const servingsQuery = useQuery({
    queryKey: ['canteen-servings', reportDate],
    queryFn: () => canteenApi.listServings({ date: reportDate }),
  });
  const salesQuery = useQuery({
    queryKey: ['canteen-pos-sales'],
    queryFn: () => canteenApi.listPosSales(),
  });
  const lowBalanceQuery = useQuery({
    queryKey: ['canteen-low-balance'],
    queryFn: () => canteenApi.getLowBalanceWallets(),
  });
  const mealCountQuery = useQuery({
    queryKey: ['canteen-meal-count', reportDate],
    queryFn: () => canteenApi.getDailyMealCountReport({ date: reportDate }),
  });
  const itemSalesQuery = useQuery({
    queryKey: ['canteen-item-sales', reportFrom, reportTo],
    queryFn: () =>
      canteenApi.getItemWiseSalesReport({ from: reportFrom, to: reportTo }),
  });
  const spendingSummaryQuery = useQuery({
    queryKey: ['canteen-spending-summary', reportFrom, reportTo],
    queryFn: () =>
      canteenApi.getStudentSpendingSummary({ from: reportFrom, to: reportTo }),
  });
  const suppliersQuery = useQuery({
    queryKey: ['canteen-suppliers'],
    queryFn: () => canteenApi.listSuppliers({ limit: 50 }),
  });
  const inventoryItemsQuery = useQuery({
    queryKey: ['canteen-inventory-items'],
    queryFn: () => canteenApi.listInventoryItems({ limit: 50 }),
  });
  const stockLedgerQuery = useQuery({
    queryKey: ['canteen-stock-ledger', reportFrom, reportTo],
    queryFn: () => canteenApi.getStockLedger({ from: reportFrom, to: reportTo }),
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => api.listStudents({ limit: 1000 }),
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
    void queryClient.invalidateQueries({
      queryKey: ['canteen-spending-summary'],
    });
    void queryClient.invalidateQueries({ queryKey: ['canteen-control'] });
    void queryClient.invalidateQueries({
      queryKey: ['canteen-control-preview'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['canteen-serving-control-preview'],
    });
    void queryClient.invalidateQueries({ queryKey: ['canteen-wallet'] });
    void queryClient.invalidateQueries({
      queryKey: ['canteen-wallet-transactions'],
    });
    void queryClient.invalidateQueries({ queryKey: ['canteen-suppliers'] });
    void queryClient.invalidateQueries({
      queryKey: ['canteen-inventory-items'],
    });
    void queryClient.invalidateQueries({ queryKey: ['canteen-stock-ledger'] });
  };

  const menuMutation = useMutation({
    mutationFn: canteenApi.createMenuItem,
    onSuccess: () => {
      setMenuForm(emptyMenuForm);
      setNotice('Menu item created.');
      invalidateCanteen();
    },
  });
  const planMutation = useMutation({
    mutationFn: canteenApi.createMealPlan,
    onSuccess: () => {
      setPlanForm(emptyPlanForm);
      setNotice('Meal plan created.');
      invalidateCanteen();
    },
  });
  const enrollmentMutation = useMutation({
    mutationFn: canteenApi.createEnrollment,
    onSuccess: () => {
      setEnrollmentForm(emptyEnrollmentForm);
      setNotice('Student enrolled.');
      invalidateCanteen();
    },
  });
  const cancelEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId: string) => canteenApi.cancelEnrollment(enrollmentId),
    onSuccess: () => {
      setNotice('Enrollment cancelled.');
      invalidateCanteen();
    },
  });
  const servingMutation = useMutation({
    mutationFn: canteenApi.serveMeal,
    onSuccess: () => {
      setServingForm(emptyServingForm);
      setServingAllergyAcknowledged(false);
      setNotice('Meal served.');
      invalidateCanteen();
    },
  });
  const createWalletMutation = useMutation({
    mutationFn: canteenApi.getOrCreateWallet,
    onSuccess: () => {
      setNotice('Wallet ready.');
      invalidateCanteen();
    },
  });
  const topUpMutation = useMutation({
    mutationFn: ({ studentId, body }: { studentId: string; body: CanteenTopUpPayload }) => canteenApi.topUpWallet(studentId, body),
    onSuccess: () => {
      setTopUpForm(emptyTopUpForm);
      setNotice('Wallet topped up.');
      invalidateCanteen();
    },
  });
  const posMutation = useMutation({
    mutationFn: canteenApi.createPosSale,
    onSuccess: () => {
      setPosForm(emptyPosForm);
      setNotice('POS sale created. Complete it from the sales list if required.');
      invalidateCanteen();
    },
  });
  const completeSaleMutation = useMutation({
    mutationFn: (saleId: string) => canteenApi.completePosSale(saleId),
    onSuccess: () => {
      setNotice('POS sale completed.');
      invalidateCanteen();
    },
  });
  const cancelSaleMutation = useMutation({
    mutationFn: (saleId: string) => canteenApi.cancelPosSale(saleId),
    onSuccess: () => {
      setNotice('POS sale cancelled.');
      invalidateCanteen();
    },
  });
  const receiptMutation = useMutation({
    mutationFn: canteenApi.getPosReceipt,
    onSuccess: (receipt) => {
      setReceiptPreview(receipt);
      setNotice(`Receipt ${receipt.receiptNumber ?? receipt.saleId} ready.`);
    },
  });
  const receiptPdfMutation = useMutation({
    mutationFn: canteenApi.openPosReceiptPdf,
    onSuccess: () => setNotice('Receipt PDF opened.'),
  });
  const dailyMealCsvMutation = useMutation({
    mutationFn: () => canteenApi.downloadDailyMealCountCsv({ date: reportDate }),
    onSuccess: () => setNotice('Daily meal count CSV downloaded.'),
  });
  const itemSalesCsvMutation = useMutation({
    mutationFn: () =>
      canteenApi.downloadItemWiseSalesCsv({ from: reportFrom, to: reportTo }),
    onSuccess: () => setNotice('Item-wise sales CSV downloaded.'),
  });
  const controlMutation = useMutation({
    mutationFn: canteenApi.upsertSpendingControl,
    onSuccess: () => {
      setNotice('Spending control saved.');
      invalidateCanteen();
    },
  });
  const supplierMutation = useMutation({
    mutationFn: canteenApi.createSupplier,
    onSuccess: () => {
      setSupplierForm(emptySupplierForm);
      setNotice('Supplier saved.');
      invalidateCanteen();
    },
  });
  const inventoryItemMutation = useMutation({
    mutationFn: canteenApi.createInventoryItem,
    onSuccess: () => {
      setInventoryItemForm(emptyInventoryItemForm);
      setNotice('Inventory item saved.');
      invalidateCanteen();
    },
  });
  const purchaseBillMutation = useMutation({
    mutationFn: canteenApi.createPurchaseBill,
    onSuccess: (bill) => {
      setPurchaseBillForm(emptyPurchaseBillForm);
      setNotice(`Purchase bill ${bill.billNumber} posted.`);
      invalidateCanteen();
    },
  });
  const wastageMutation = useMutation({
    mutationFn: canteenApi.recordWastage,
    onSuccess: () => {
      setWastageForm(emptyWastageForm);
      setNotice('Wastage recorded.');
      invalidateCanteen();
    },
  });
  const stockAdjustmentMutation = useMutation({
    mutationFn: canteenApi.adjustStock,
    onSuccess: () => {
      setStockAdjustmentForm(emptyStockAdjustmentForm);
      setNotice('Stock adjustment recorded.');
      invalidateCanteen();
    },
  });
  const reverseWalletTransactionMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => canteenApi.reverseWalletTransaction(transactionId, { reason }),
    onSuccess: () => {
      setWalletReversal(null);
      setWalletReversalReason('');
      setNotice('Transaction reversed.');
      invalidateCanteen();
    },
  });

  const menuItems = itemsFromResult(menuQuery.data);
  const plans = itemsFromResult(plansQuery.data);
  const enrollments = itemsFromResult(enrollmentsQuery.data);
  const servings = itemsFromResult(servingsQuery.data);
  const sales = itemsFromResult(salesQuery.data);
  const lowBalanceWallets = itemsFromResult(lowBalanceQuery.data);
  const suppliers = itemsFromResult(suppliersQuery.data);
  const inventoryItems = itemsFromResult(inventoryItemsQuery.data);
  const stockLedgerRows = itemsFromResult(stockLedgerQuery.data);
  const walletTransactions = itemsFromResult(transactionsQuery.data);
  const allergyWarnings = servings.filter((serving) => Boolean(serving.dietaryWarning));

  const stats = {
    activeMenuItems: menuItems.filter((item) => item.status === 'ACTIVE').length,
    activeMealPlans: plans.filter((plan) => plan.status === 'ACTIVE').length,
    mealsServedToday: servings.filter((serving) => serving.status === 'SERVED').length,
    walletLow: lowBalanceWallets.length,
    allergyWarnings: allergyWarnings.length,
  };

  const selectedServingStudent = servingForm.studentId;
  const servingHasAllergyWarnings =
    (resolvedServingStudent?.allergyWarnings?.length ?? 0) > 0;
  const servingStudentControlQuery = useQuery({
    queryKey: ['canteen-serving-control-preview', selectedServingStudent],
    queryFn: () => canteenApi.getSpendingControl(selectedServingStudent!),
    enabled: Boolean(selectedServingStudent),
  });

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

  const selectedControlStudent = controlForm.studentId;
  const controlStudentQuery = useQuery({
    queryKey: ['canteen-control', selectedControlStudent],
    queryFn: () => canteenApi.getSpendingControl(selectedControlStudent!),
    enabled: activeTab === 'controls' && Boolean(selectedControlStudent),
  });

  useEffect(() => {
    if (!selectedControlStudent || !controlStudentQuery.isSuccess) return;

    const savedControl = controlStudentQuery.data;
    setControlForm((current) => {
      if (current.studentId !== selectedControlStudent) return current;
      if (!savedControl) {
        return { ...emptyControlForm, studentId: selectedControlStudent };
      }

      return {
        studentId: savedControl.studentId,
        dailySpendingLimit: optionalNumber(savedControl.dailySpendingLimit),
        blockedCategories: savedControl.blockedCategories ?? [],
        blockedMenuItemIds: savedControl.blockedMenuItemIds ?? [],
        lowBalanceThreshold: optionalNumber(savedControl.lowBalanceThreshold),
        isActive: savedControl.isActive,
      };
    });
  }, [
    selectedControlStudent,
    controlStudentQuery.data,
    controlStudentQuery.isSuccess,
  ]);

  const firstError = menuQuery.error || plansQuery.error || enrollmentsQuery.error || servingsQuery.error || salesQuery.error || lowBalanceQuery.error || suppliersQuery.error || inventoryItemsQuery.error || stockLedgerQuery.error;

  function normalizeScannedStudent(data: CanteenQrStudent) {
    const studentId = data.id ?? data.studentId;
    if (!studentId) return null;

    return { ...data, id: studentId };
  }

  return (
    <div className="space-y-6">
      {notice ? <Notice tone="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
      {firstError ? <Notice tone="error" message={(firstError as Error).message} /> : null}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title="Active Menu Items" value={stats.activeMenuItems} icon={<Utensils size={18} />} loading={menuQuery.isLoading} />
            <StatCard title="Active Meal Plans" value={stats.activeMealPlans} icon={<Soup size={18} />} loading={plansQuery.isLoading} />
            <StatCard title="Meals Served Today" value={stats.mealsServedToday} icon={<Soup size={18} />} loading={servingsQuery.isLoading} />
            <StatCard title="Wallet Low" value={stats.walletLow} icon={<Wallet size={18} />} loading={lowBalanceQuery.isLoading} />
            <StatCard title="Allergy Warnings" value={stats.allergyWarnings} icon={<AlertTriangle size={18} />} loading={servingsQuery.isLoading} />
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.walletLow > 0 ? <CanteenStatusBadge status="WALLET_LOW" /> : null}
            {stats.allergyWarnings > 0 ? <CanteenStatusBadge status="ALLERGY_WARNING" /> : null}
          </div>
          <InfoCard lines={['All wallet, POS, and meal-plan fee totals come from backend responses; frontend does not calculate financial truth.', 'Canteen revenue and meal-plan fee effects stay backend-controlled through AccountingPostingService and FinanceService boundaries.', 'Allergy and dietary warnings are shown when backend serving responses include warning data.']} />
          <LowBalanceList wallets={lowBalanceWallets.slice(0, 5)} />
          <SaleList sales={sales.slice(0, 5)} emptyTitle="No recent POS sales" />
        </div>
      )}

      {activeTab === 'menu' && (
        <TwoColumn>
          <Panel title="Menu items" description="Maintain food, snack, drink, and meal item catalogues.">
            {menuQuery.isLoading ? <LoadingState label="Loading menu..." /> : null}
            <div className="space-y-3">
              {menuItems.map((item) => (
                <RecordCard key={item.id} title={item.name} subtitle={`${item.category} • ${money(item.unitPrice)}`} badge={<CanteenStatusBadge status={item.status} />} />
              ))}
            </div>
            {menuItems.length === 0 && !menuQuery.isLoading ? <EmptyState title="No menu items" description="Add the first canteen menu item." /> : null}
          </Panel>
          <Panel title="Create menu item" description="Use allergen tags like peanut, dairy, gluten, egg.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                menuMutation.mutate(cleanMenu(menuForm));
              }}
            >
              <TextInput label="Name" value={menuForm.name} onChange={(name) => setMenuForm({ ...menuForm, name })} required />
              <TextInput label="Category" value={menuForm.category} onChange={(category) => setMenuForm({ ...menuForm, category })} required />
              <TextInput label="Unit price" type="number" value={String(menuForm.unitPrice)} onChange={(value) => setMenuForm({ ...menuForm, unitPrice: Number(value) || 0 })} required />
              <TextInput label="Allergen tags" value={menuForm.allergenTags?.join(', ') ?? ''} onChange={(value) => setMenuForm({ ...menuForm, allergenTags: splitCsv(value) })} />
              <button type="submit" className="btn-primary" disabled={menuMutation.isPending}>
                {menuMutation.isPending ? 'Saving...' : 'Create item'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'plans' && (
        <TwoColumn>
          <Panel title="Meal plans" description="Manage lunch, snacks, hostel, staff, and recurring meal plans.">
            {plansQuery.isLoading ? <LoadingState label="Loading meal plans..." /> : null}
            <div className="space-y-3">
              {plans.map((plan) => (
                <RecordCard key={plan.id} title={plan.name} subtitle={`${plan.mealType} • ${money(plan.price)} • ${plan.billingFrequency}`} badge={<CanteenStatusBadge status={plan.status} />} />
              ))}
            </div>
            {plans.length === 0 && !plansQuery.isLoading ? <EmptyState title="No meal plans" description="Create a meal plan to enroll students." /> : null}
          </Panel>
          <Panel title="Create meal plan" description="Duplicate serving prevention is enabled by default.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                planMutation.mutate(cleanPlan(planForm));
              }}
            >
              <TextInput label="Plan name" value={planForm.name} onChange={(name) => setPlanForm({ ...planForm, name })} required />
              <SelectInput label="Meal type" value={planForm.mealType} onChange={(mealType) => setPlanForm({ ...planForm, mealType })} options={mealTypeOptions()} />
              <TextInput label="Price" type="number" value={String(planForm.price)} onChange={(value) => setPlanForm({ ...planForm, price: Number(value) || 0 })} required />
              <SelectInput
                label="Billing frequency"
                value={planForm.billingFrequency ?? 'MONTHLY'}
                onChange={(billingFrequency) => setPlanForm({ ...planForm, billingFrequency })}
                options={[
                  { label: 'Daily', value: 'DAILY' },
                  { label: 'Weekly', value: 'WEEKLY' },
                  { label: 'Monthly', value: 'MONTHLY' },
                ]}
              />
              <button type="submit" className="btn-primary" disabled={planMutation.isPending}>
                {planMutation.isPending ? 'Saving...' : 'Create plan'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'enrollments' && (
        <TwoColumn>
          <Panel title="Student enrollments" description="Track student meal plan enrollment and cancellation.">
            <div className="space-y-3">
              {enrollments.map((enrollment) => (
                <RecordCard
                  key={enrollment.id}
                  title={studentLabel(enrollment.student) || enrollment.studentId}
                  subtitle={`${enrollment.mealPlan?.name ?? enrollment.mealPlanId} • starts ${enrollment.startsOn?.slice(0, 10)}${enrollment.feeInvoiceId ? ` • fee invoice linked ${enrollment.feeInvoiceId.slice(0, 8)}` : ''}`}
                  badge={<CanteenStatusBadge status={enrollment.status} />}
                  action={
                    enrollment.status === 'ACTIVE' || enrollment.feeInvoiceId ? (
                      <div className="flex flex-wrap gap-2">
                        {enrollment.feeInvoiceId ? (
                          <Link
                            href={`/dashboard/finance?invoiceId=${encodeURIComponent(enrollment.feeInvoiceId)}`}
                            className="btn-secondary"
                          >
                            Open invoice
                          </Link>
                        ) : null}
                        {enrollment.status === 'ACTIVE' ? (
                          <button type="button" className="btn-secondary text-red-600" onClick={() => setConfirmingEnrollmentId(enrollment.id)}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
            {enrollments.length === 0 && !enrollmentsQuery.isLoading ? <EmptyState title="No enrollments" description="Enroll students into meal plans." /> : null}
          </Panel>
          <Panel title="Enroll student" description="Meal enrollment is tenant-scoped and uses real student records.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                enrollmentMutation.mutate(cleanEnrollment(enrollmentForm));
              }}
            >
              <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={enrollmentForm.studentId} onSelect={(studentId) => setEnrollmentForm({ ...enrollmentForm, studentId })} label="Student" />
              <SelectInput
                label="Meal plan"
                value={enrollmentForm.mealPlanId}
                onChange={(mealPlanId) => setEnrollmentForm({ ...enrollmentForm, mealPlanId })}
                required
                options={plans.map((plan) => ({
                  label: plan.name,
                  value: plan.id,
                }))}
              />
              <TextInput label="Starts on" type="date" value={enrollmentForm.startsOn} onChange={(startsOn) => setEnrollmentForm({ ...enrollmentForm, startsOn })} required />
              <button type="submit" className="btn-primary" disabled={enrollmentMutation.isPending}>
                {enrollmentMutation.isPending ? 'Enrolling...' : 'Enroll student'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'serving' && (
        <TwoColumn>
          <Panel title="Meal serving history" description="Duplicate serving errors are returned by the backend and shown as readable errors.">
            <div className="space-y-3">
              {servings.map((serving) => (
                <RecordCard
                  key={serving.id}
                  title={studentLabel(serving.student) || serving.studentId}
                  subtitle={`${serving.mealType} • ${serving.mealDate?.slice(0, 10)}${serving.dietaryWarning ? ` • ${serving.dietaryWarning}` : ''}`}
                  badge={
                    <div className="flex flex-wrap gap-2">
                      <CanteenStatusBadge status={serving.status} />
                      {serving.dietaryWarning ? <CanteenStatusBadge status="ALLERGY_WARNING" /> : null}
                    </div>
                  }
                />
              ))}
            </div>
            {servings.length === 0 && !servingsQuery.isLoading ? <EmptyState title="No servings" description="Served meals will appear here." /> : null}
          </Panel>
          <Panel title="Student ID / QR Serving" description="Scan student QR to instantly serve enrolled meals.">
            <QRResolver
              purpose="CANTEEN_SERVE"
              autoFocus
              helperText="Scan a student QR; the serving form stays ready for meal confirmation."
              placeholder="Scan canteen serving QR token"
              submitLabel="Select"
              onResolved={(data) => {
                const student = normalizeScannedStudent(data);
                if (student) {
                  setResolvedServingStudent(student);
                  setServingAllergyAcknowledged(false);
                  setServingForm({ ...servingForm, studentId: student.id ?? '' });
                }
              }}
              className="mb-6"
            />
            {resolvedServingStudent ? (
              <CanteenQrStudentCard student={resolvedServingStudent} context="serving" />
            ) : null}
            <form
              className="space-y-4 border-t border-slate-100 pt-6"
              onSubmit={(event) => {
                event.preventDefault();
                servingMutation.mutate(cleanServing(servingForm));
              }}
            >
              <StudentSelector
                students={studentsQuery.data?.items ?? []}
                selectedId={servingForm.studentId}
                onSelect={(studentId) => {
                  setServingForm({ ...servingForm, studentId });
                  setServingAllergyAcknowledged(false);
                  if (studentId !== resolvedServingStudent?.id) {
                    setResolvedServingStudent(null);
                  }
                }}
                label="Or Select Student Manually"
              />
              <SelectInput label="Meal type" value={servingForm.mealType ?? 'LUNCH'} onChange={(mealType) => setServingForm({ ...servingForm, mealType })} options={mealTypeOptions()} />
              <TextInput label="Meal date" type="date" value={servingForm.mealDate ?? today} onChange={(mealDate) => setServingForm({ ...servingForm, mealDate })} />

              {servingStudentControlQuery.data?.blockedCategories?.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Warning: Parent has blocked items: {servingStudentControlQuery.data.blockedCategories.join(', ')}</div> : null}

              {servingHasAllergyWarnings ? (
                <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
                  <input
                    type="checkbox"
                    checked={servingAllergyAcknowledged}
                    onChange={(event) =>
                      setServingAllergyAcknowledged(event.target.checked)
                    }
                    className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-200"
                  />
                  <span>
                    {servingAllergyAcknowledgementLabel} serving the meal.
                  </span>
                </label>
              ) : null}

              <button
                type="submit"
                className="btn-primary w-full h-12"
                disabled={
                  servingMutation.isPending ||
                  !servingForm.studentId ||
                  (servingHasAllergyWarnings && !servingAllergyAcknowledged)
                }
              >
                {servingMutation.isPending ? 'Serving...' : 'Serve meal now'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'wallets' && (
        <TwoColumn>
          <Panel title="Wallet balance" description="Create wallet, view balance, and review transaction history.">
            <StudentSelector students={studentsQuery.data?.items ?? []} selectedId={walletStudentId} onSelect={setWalletStudentId} label="Student" />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary" disabled={!walletStudentId || createWalletMutation.isPending} onClick={() => createWalletMutation.mutate(walletStudentId)}>
                Create / load wallet
              </button>
            </div>
            {walletQuery.data ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Balance</p>
                    <p className="text-2xl font-black text-slate-900">{money(walletQuery.data.balance)}</p>
                    <p className="text-xs text-slate-400">Low balance threshold: {money(walletQuery.data.lowBalanceThreshold)}</p>
                  </div>
                  {isWalletLow(walletQuery.data.balance, walletQuery.data.lowBalanceThreshold) ? <CanteenStatusBadge status="WALLET_LOW" /> : null}
                </div>
              </div>
            ) : (
              <EmptyState title="No wallet selected" description="Select a student to view or create a wallet." />
            )}
            {walletReversal ? (
              <form
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = walletReversalReason.trim();
                  if (!reason) return;
                  reverseWalletTransactionMutation.mutate({
                    transactionId: walletReversal.transactionId,
                    reason,
                  });
                }}
              >
                <p className="text-sm font-bold text-amber-950">Reverse wallet transaction</p>
                <p className="mt-1 text-xs text-amber-800">{walletReversal.label}</p>
                <textarea
                  className="mt-3 min-h-24 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                  value={walletReversalReason}
                  onChange={(event) => setWalletReversalReason(event.target.value)}
                  placeholder="Enter an audited reversal reason"
                />
                {reverseWalletTransactionMutation.error ? (
                  <InlineError message={reverseWalletTransactionMutation.error.message} />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="btn-primary text-xs"
                    disabled={!walletReversalReason.trim() || reverseWalletTransactionMutation.isPending}
                  >
                    Confirm reversal
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setWalletReversal(null);
                      setWalletReversalReason('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            <div className="mt-4 space-y-3">
              {walletTransactions.slice(0, 10).map((tx) => (
                <RecordCard
                  key={tx.id}
                  title={`${tx.type} • ${money(tx.amount)}`}
                  subtitle={`Balance after: ${money(tx.balanceAfter)} • ${tx.note ?? 'No note'}${tx.reversalOfId ? ' (Reversal)' : ''}`}
                  action={
                    !tx.reversalOfId && (tx.type === 'TOP_UP' || tx.type === 'DEDUCTION') ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => {
                          setWalletReversal({
                            transactionId: tx.id,
                            label: `${tx.type} - ${money(tx.amount)}`,
                          });
                          setWalletReversalReason('');
                        }}
                      >
                        Reverse
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          </Panel>
          <Panel title="Manual top-up" description="Top-up writes are backend-controlled and audited.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (walletStudentId)
                  topUpMutation.mutate({
                    studentId: walletStudentId,
                    body: cleanTopUp(topUpForm),
                  });
              }}
            >
              <TextInput label="Amount (NPR)" type="number" value={String(topUpForm.amount)} onChange={(value) => setTopUpForm({ ...topUpForm, amount: Number(value) || 0 })} required />
              <TextInput
                label="Low balance threshold"
                type="number"
                value={topUpForm.lowBalanceThreshold?.toString() ?? ''}
                onChange={(value) =>
                  setTopUpForm({
                    ...topUpForm,
                    lowBalanceThreshold: value ? Number(value) : undefined,
                  })
                }
              />
              <TextInput label="Internal Note" value={topUpForm.note ?? ''} onChange={(note) => setTopUpForm({ ...topUpForm, note })} />
              <button type="submit" className="btn-primary w-full" disabled={!walletStudentId || topUpMutation.isPending}>
                {topUpMutation.isPending ? 'Topping up...' : 'Top up wallet'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'pos' && (
        <TwoColumn>
          <Panel title="POS sales" description="Create, complete, or cancel canteen POS sales.">
            <SaleList sales={sales} emptyTitle="No POS sales" onComplete={(saleId) => setConfirmingSaleId(`complete:${saleId}`)} onCancel={(saleId) => setConfirmingSaleId(`cancel:${saleId}`)} onReceipt={(saleId) => receiptMutation.mutate(saleId)} onReceiptPdf={(saleId) => receiptPdfMutation.mutate(saleId)} receiptLoadingSaleId={receiptMutation.isPending ? receiptMutation.variables : receiptPdfMutation.isPending ? receiptPdfMutation.variables : undefined} />
            {receiptMutation.error ? <InlineError message={(receiptMutation.error as Error).message} /> : null}
            {receiptPdfMutation.error ? <InlineError message={(receiptPdfMutation.error as Error).message} /> : null}
            {receiptPreview ? <ReceiptPreview receipt={receiptPreview} /> : null}
          </Panel>
          <Panel title="Create POS sale" description="Wallet spending limits and balance checks are enforced by backend.">
            <QRResolver
              purpose="CANTEEN_POS"
              autoFocus
              helperText="Scan student QR to select wallet payment and preview balance warnings."
              placeholder="Scan canteen POS QR token"
              submitLabel="Select"
              onResolved={(data) => {
                const student = normalizeScannedStudent(data);
                if (student) {
                  setResolvedPosStudent(student);
                  setPosForm({
                    ...posForm,
                    studentId: student.id ?? '',
                    paymentMethod: 'WALLET',
                  });
                }
              }}
              className="mb-6"
            />
            {resolvedPosStudent ? (
              <CanteenQrStudentCard student={resolvedPosStudent} context="pos" />
            ) : null}
            <form
              className="space-y-4 border-t border-slate-100 pt-6"
              onSubmit={(event) => {
                event.preventDefault();
                posMutation.mutate(cleanPos(posForm));
              }}
            >
              <StudentSelector
                students={studentsQuery.data?.items ?? []}
                selectedId={posForm.studentId ?? ''}
                onSelect={(studentId) => {
                  setPosForm({ ...posForm, studentId });
                  if (studentId !== resolvedPosStudent?.id) {
                    setResolvedPosStudent(null);
                  }
                }}
                label="Or Select Student"
                optional
              />
              <SelectInput
                label="Payment method"
                value={posForm.paymentMethod}
                onChange={(paymentMethod) =>
                  setPosForm({
                    ...posForm,
                    paymentMethod: paymentMethod as CanteenPaymentMethod,
                  })
                }
                options={[
                  { label: 'Cash', value: 'CASH' },
                  { label: 'Wallet', value: 'WALLET' },
                  { label: 'Staff credit', value: 'STAFF_CREDIT' },
                ]}
              />
              <MenuItemSelector
                items={menuItems}
                selectedId={posForm.items[0]?.menuItemId ?? ''}
                onSelect={(menuItemId) =>
                  setPosForm({
                    ...posForm,
                    items: [{ ...(posForm.items[0] ?? { quantity: 1 }), menuItemId }],
                  })
                }
                label="Menu Item"
              />
              <TextInput
                label="Quantity"
                type="number"
                value={String(posForm.items[0]?.quantity ?? 1)}
                onChange={(value) =>
                  setPosForm({
                    ...posForm,
                    items: [
                      {
                        ...(posForm.items[0] ?? { menuItemId: '' }),
                        quantity: Number(value) || 1,
                      },
                    ],
                  })
                }
              />

              {posStudentWalletQuery.data ? <div className={cn('rounded-xl border p-3 text-sm font-bold', isWalletLow(posStudentWalletQuery.data.balance, posStudentWalletQuery.data.lowBalanceThreshold) ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-800')}>Wallet Balance: {money(posStudentWalletQuery.data.balance)}</div> : null}

              {posStudentControlQuery.data?.blockedCategories?.length ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">Warning: blocked categories: {posStudentControlQuery.data.blockedCategories.join(', ')}</div> : null}

              <button
                type="submit"
                className="btn-primary w-full h-12 text-base"
                disabled={
                  posMutation.isPending ||
                  !posForm.studentId ||
                  !posForm.items[0]?.menuItemId ||
                  Number(posForm.items[0]?.quantity ?? 0) <= 0
                }
              >
                {posMutation.isPending ? 'Creating Sale...' : 'Create POS sale'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'inventory' && (
        <TwoColumn>
          <div className="space-y-6">
            <Panel title="Inventory status" description="Track stocked items, supplier linkage, reorder levels, and stock ledger activity.">
              <InfoCard lines={['Inventory rows come from the backend supplier and inventory endpoints.', 'Purchase bills, wastage, and manual stock corrections remain backend-owned and are reflected in the stock ledger.', 'Financial posting for purchase bills stays behind the approved backend accounting boundary.']} />
              {inventoryItemsQuery.isLoading ? <LoadingState label="Loading inventory..." /> : null}
              <div className="mt-4 space-y-3">
                {inventoryItems.map((item) => {
                  const supplier = suppliers.find((candidate) => candidate.id === item.defaultSupplierId);
                  const stockIsLow = Number(item.currentStock) <= Number(item.minStockLevel);

                  return <RecordCard key={item.id} title={item.name} subtitle={`${item.sku ? `${item.sku} • ` : ''}${item.category} • Stock ${formatQuantity(item.currentStock, item.unit)} • Min ${formatQuantity(item.minStockLevel, item.unit)} • Cost ${money(item.unitCost)}${supplier ? ` • ${supplier.name}` : ''}`} badge={<StatusBadge status={stockIsLow ? 'LOW' : 'ACTIVE'} label={stockIsLow ? 'Low Stock' : 'In Stock'} tone={stockIsLow ? 'pending' : 'approved'} />} />;
                })}
                {!inventoryItemsQuery.isLoading && inventoryItems.length === 0 ? <EmptyState title="No inventory items" description="Create the first stock item for purchase bills, wastage, and stock movement reports." /> : null}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Recent stock ledger</h3>
                <div className="mt-3 space-y-2">
                  {stockLedgerQuery.isLoading ? <LoadingState label="Loading stock ledger..." /> : null}
                  {stockLedgerRows.slice(0, 5).map((row) => (
                    <p key={row.id ?? `${row.inventoryItemId}-${row.movementDate}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {row.inventoryItem?.name ?? row.inventoryItemId?.slice?.(0, 8) ?? 'Stock item'} • {row.type ?? 'MOVEMENT'} • {formatQuantity(row.quantity ?? 0, row.inventoryItem?.unit ?? '')} • balance {formatQuantity(row.balanceAfter ?? 0, row.inventoryItem?.unit ?? '')}
                    </p>
                  ))}
                  {!stockLedgerQuery.isLoading && stockLedgerRows.length === 0 ? <EmptyState title="No stock movement" description="Purchase bills, wastage, and manual adjustments will appear here." /> : null}
                </div>
              </div>
            </Panel>

            <Panel title="Stock operations" description="Post purchase bills, record wastage, and make audited manual stock corrections.">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  purchaseBillMutation.mutate(cleanPurchaseBillPayload(purchaseBillForm));
                }}
              >
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Purchase bill</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectInput
                    label="Supplier"
                    value={purchaseBillForm.supplierId}
                    onChange={(supplierId) => setPurchaseBillForm({ ...purchaseBillForm, supplierId })}
                    required
                    options={suppliers.map((supplier) => ({
                      label: supplier.name,
                      value: supplier.id,
                    }))}
                  />
                  <TextInput label="Bill number" value={purchaseBillForm.billNumber} onChange={(billNumber) => setPurchaseBillForm({ ...purchaseBillForm, billNumber })} required />
                  <TextInput label="Bill date" type="date" value={purchaseBillForm.billDate} onChange={(billDate) => setPurchaseBillForm({ ...purchaseBillForm, billDate })} required />
                  <SelectInput
                    label="Stock item"
                    value={purchaseBillForm.items[0]?.inventoryItemId ?? ''}
                    onChange={(inventoryItemId) =>
                      setPurchaseBillForm(
                        updateFirstPurchaseBillItem(purchaseBillForm, {
                          inventoryItemId,
                        }),
                      )
                    }
                    required
                    options={inventoryItems.map((item) => ({
                      label: item.name,
                      value: item.id,
                    }))}
                  />
                  <TextInput
                    label="Quantity"
                    type="number"
                    value={String(purchaseBillForm.items[0]?.quantity ?? 1)}
                    onChange={(quantity) =>
                      setPurchaseBillForm(
                        updateFirstPurchaseBillItem(purchaseBillForm, {
                          quantity: Number(quantity) || 0,
                        }),
                      )
                    }
                    required
                  />
                  <TextInput
                    label="Unit cost (NPR)"
                    type="number"
                    value={String(purchaseBillForm.items[0]?.unitCost ?? 0)}
                    onChange={(unitCost) =>
                      setPurchaseBillForm(
                        updateFirstPurchaseBillItem(purchaseBillForm, {
                          unitCost: Number(unitCost) || 0,
                        }),
                      )
                    }
                    required
                  />
                  <TextInput
                    label="Batch number"
                    value={purchaseBillForm.items[0]?.batchNumber ?? ''}
                    onChange={(batchNumber) =>
                      setPurchaseBillForm(
                        updateFirstPurchaseBillItem(purchaseBillForm, {
                          batchNumber,
                        }),
                      )
                    }
                  />
                  <TextInput
                    label="Expiry date"
                    type="date"
                    value={purchaseBillForm.items[0]?.expiryDate ?? ''}
                    onChange={(expiryDate) =>
                      setPurchaseBillForm(
                        updateFirstPurchaseBillItem(purchaseBillForm, {
                          expiryDate,
                        }),
                      )
                    }
                  />
                  <TextInput
                    label="Tax (NPR)"
                    type="number"
                    value={String(purchaseBillForm.taxAmount ?? 0)}
                    onChange={(taxAmount) =>
                      setPurchaseBillForm({
                        ...purchaseBillForm,
                        taxAmount: Number(taxAmount) || 0,
                      })
                    }
                  />
                  <TextInput
                    label="Discount (NPR)"
                    type="number"
                    value={String(purchaseBillForm.discountAmount ?? 0)}
                    onChange={(discountAmount) =>
                      setPurchaseBillForm({
                        ...purchaseBillForm,
                        discountAmount: Number(discountAmount) || 0,
                      })
                    }
                  />
                </div>
                <TextInput label="Notes" value={purchaseBillForm.notes ?? ''} onChange={(notes) => setPurchaseBillForm({ ...purchaseBillForm, notes })} />
                <button type="submit" className="btn-primary w-full" disabled={purchaseBillMutation.isPending || suppliers.length === 0 || inventoryItems.length === 0}>
                  {purchaseBillMutation.isPending ? 'Posting purchase...' : 'Post purchase bill'}
                </button>
                {purchaseBillMutation.error ? <InlineError message={(purchaseBillMutation.error as Error).message} /> : null}
              </form>

              <div className="my-5 border-t border-slate-100" />

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  wastageMutation.mutate(cleanWastagePayload(wastageForm));
                }}
              >
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Wastage</h3>
                <SelectInput
                  label="Stock item"
                  value={wastageForm.inventoryItemId}
                  onChange={(inventoryItemId) => setWastageForm({ ...wastageForm, inventoryItemId })}
                  required
                  options={inventoryItems.map((item) => ({
                    label: item.name,
                    value: item.id,
                  }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Quantity"
                    type="number"
                    value={String(wastageForm.quantity)}
                    onChange={(quantity) =>
                      setWastageForm({
                        ...wastageForm,
                        quantity: Number(quantity) || 0,
                      })
                    }
                    required
                  />
                  <TextInput label="Wastage date" type="date" value={wastageForm.wastageDate} onChange={(wastageDate) => setWastageForm({ ...wastageForm, wastageDate })} required />
                </div>
                <TextInput label="Reason" value={wastageForm.reason} onChange={(reason) => setWastageForm({ ...wastageForm, reason })} required />
                <TextInput label="Notes" value={wastageForm.notes ?? ''} onChange={(notes) => setWastageForm({ ...wastageForm, notes })} />
                <button type="submit" className="btn-secondary w-full" disabled={wastageMutation.isPending || inventoryItems.length === 0}>
                  {wastageMutation.isPending ? 'Recording wastage...' : 'Record wastage'}
                </button>
                {wastageMutation.error ? <InlineError message={(wastageMutation.error as Error).message} /> : null}
              </form>

              <div className="my-5 border-t border-slate-100" />

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  stockAdjustmentMutation.mutate(cleanStockAdjustmentPayload(stockAdjustmentForm));
                }}
              >
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Manual adjustment</h3>
                <SelectInput
                  label="Stock item"
                  value={stockAdjustmentForm.inventoryItemId}
                  onChange={(inventoryItemId) =>
                    setStockAdjustmentForm({
                      ...stockAdjustmentForm,
                      inventoryItemId,
                    })
                  }
                  required
                  options={inventoryItems.map((item) => ({
                    label: item.name,
                    value: item.id,
                  }))}
                />
                <TextInput
                  label="Quantity change"
                  type="number"
                  value={String(stockAdjustmentForm.quantity)}
                  onChange={(quantity) =>
                    setStockAdjustmentForm({
                      ...stockAdjustmentForm,
                      quantity: Number(quantity) || 0,
                    })
                  }
                  required
                />
                <TextInput label="Reason" value={stockAdjustmentForm.reason} onChange={(reason) => setStockAdjustmentForm({ ...stockAdjustmentForm, reason })} required />
                <button type="submit" className="btn-secondary w-full" disabled={stockAdjustmentMutation.isPending || inventoryItems.length === 0}>
                  {stockAdjustmentMutation.isPending ? 'Saving adjustment...' : 'Save stock adjustment'}
                </button>
                {stockAdjustmentMutation.error ? <InlineError message={(stockAdjustmentMutation.error as Error).message} /> : null}
              </form>
            </Panel>
          </div>
          <Panel title="Suppliers and stock items" description="Create vendor records and inventory catalog entries through real canteen APIs.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                supplierMutation.mutate(cleanSupplierPayload(supplierForm));
              }}
            >
              <TextInput label="Supplier name" value={supplierForm.name} onChange={(name) => setSupplierForm({ ...supplierForm, name })} required />
              <TextInput label="Contact person" value={supplierForm.contactName ?? ''} onChange={(contactName) => setSupplierForm({ ...supplierForm, contactName })} />
              <TextInput label="Phone" value={supplierForm.phone ?? ''} onChange={(phone) => setSupplierForm({ ...supplierForm, phone })} />
              <TextInput label="PAN/VAT number" value={supplierForm.panNumber ?? ''} onChange={(panNumber) => setSupplierForm({ ...supplierForm, panNumber })} />
              <button type="submit" className="btn-primary w-full" disabled={supplierMutation.isPending}>
                {supplierMutation.isPending ? 'Saving supplier...' : 'Save supplier'}
              </button>
              {supplierMutation.error ? <InlineError message={(supplierMutation.error as Error).message} /> : null}
            </form>

            <div className="my-5 border-t border-slate-100" />

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                inventoryItemMutation.mutate(cleanInventoryItemPayload(inventoryItemForm));
              }}
            >
              <TextInput label="Item name" value={inventoryItemForm.name} onChange={(name) => setInventoryItemForm({ ...inventoryItemForm, name })} required />
              <TextInput label="SKU" value={inventoryItemForm.sku ?? ''} onChange={(sku) => setInventoryItemForm({ ...inventoryItemForm, sku })} />
              <TextInput label="Category" value={inventoryItemForm.category} onChange={(category) => setInventoryItemForm({ ...inventoryItemForm, category })} required />
              <SelectInput
                label="Unit"
                value={inventoryItemForm.unit}
                onChange={(unit) => setInventoryItemForm({ ...inventoryItemForm, unit })}
                required
                options={[
                  { label: 'Pieces', value: 'pcs' },
                  { label: 'Kilograms', value: 'kg' },
                  { label: 'Litres', value: 'ltr' },
                  { label: 'Packets', value: 'packet' },
                ]}
              />
              <TextInput
                label="Minimum stock"
                type="number"
                value={String(inventoryItemForm.minStockLevel ?? 0)}
                onChange={(minStockLevel) =>
                  setInventoryItemForm({
                    ...inventoryItemForm,
                    minStockLevel: Number(minStockLevel) || 0,
                  })
                }
              />
              <TextInput
                label="Unit cost (NPR)"
                type="number"
                value={String(inventoryItemForm.unitCost ?? 0)}
                onChange={(unitCost) =>
                  setInventoryItemForm({
                    ...inventoryItemForm,
                    unitCost: Number(unitCost) || 0,
                  })
                }
              />
              <SelectInput
                label="Default supplier"
                value={inventoryItemForm.defaultSupplierId ?? ''}
                onChange={(defaultSupplierId) =>
                  setInventoryItemForm({
                    ...inventoryItemForm,
                    defaultSupplierId,
                  })
                }
                options={suppliers.map((supplier) => ({
                  label: supplier.name,
                  value: supplier.id,
                }))}
              />
              <button type="submit" className="btn-primary w-full" disabled={inventoryItemMutation.isPending}>
                {inventoryItemMutation.isPending ? 'Saving item...' : 'Save stock item'}
              </button>
              {inventoryItemMutation.error ? <InlineError message={(inventoryItemMutation.error as Error).message} /> : null}
            </form>

            <div className="mt-5 space-y-2">
              {suppliersQuery.isLoading ? <LoadingState label="Loading suppliers..." /> : null}
              {suppliers.slice(0, 5).map((supplier) => (
                <p key={supplier.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {supplier.name}
                  {supplier.contactName ? ` • ${supplier.contactName}` : ''}
                  {supplier.phone ? ` • ${supplier.phone}` : ''}
                </p>
              ))}
              {!suppliersQuery.isLoading && suppliers.length === 0 ? <EmptyState title="No suppliers" description="Supplier records are required before purchase bills can be linked to vendors." /> : null}
            </div>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'controls' && (
        <TwoColumn>
          <Panel title="Saved spending control" description="Shows the tenant-scoped backend control for the selected student.">
            <InfoCard lines={['Controls are loaded from the backend and applied server-side during POS workflows.', 'Use comma-separated blocked categories for category rules.']} />
            {!selectedControlStudent ? <EmptyState title="Select a student" description="Choose a student in the form to load their saved spending control." /> : null}
            {selectedControlStudent && controlStudentQuery.isLoading ? <LoadingState label="Loading saved control..." /> : null}
            {controlStudentQuery.error ? <InlineError message={(controlStudentQuery.error as Error).message} /> : null}
            {selectedControlStudent && controlStudentQuery.isSuccess && !controlStudentQuery.data ? (
              <EmptyState title="No saved control" description="This student does not have a canteen spending control yet." />
            ) : null}
            {controlStudentQuery.data ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CanteenStatusBadge status={controlStudentQuery.data.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  {controlStudentQuery.data.blockedCategories.length || controlStudentQuery.data.blockedMenuItemIds.length ? <CanteenStatusBadge status="BLOCKED_BY_PARENT_LIMIT" /> : null}
                </div>
                <p className="mt-3 text-sm text-slate-600">Daily limit: {controlStudentQuery.data.dailySpendingLimit ? money(controlStudentQuery.data.dailySpendingLimit) : 'Not set'}</p>
                <p className="mt-1 text-sm text-slate-600">Low balance threshold: {controlStudentQuery.data.lowBalanceThreshold ? money(controlStudentQuery.data.lowBalanceThreshold) : 'Not set'}</p>
                <p className="mt-1 text-sm text-slate-600">Blocked categories: {controlStudentQuery.data.blockedCategories.join(', ') || 'None selected'}</p>
                <p className="mt-1 text-sm text-slate-600">Blocked item IDs: {controlStudentQuery.data.blockedMenuItemIds.join(', ') || 'None selected'}</p>
              </div>
            ) : null}
          </Panel>
          <Panel title="Save control" description="Server-side controls protect canteen spending rules.">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                controlMutation.mutate(cleanControl(controlForm));
              }}
            >
              <StudentSelector students={studentsQuery.data?.items ?? []} onSelect={(studentId) => setControlForm({ ...controlForm, studentId })} label="Student" selectedId={controlForm.studentId} />
              <TextInput
                label="Daily spending limit (NPR)"
                type="number"
                value={controlForm.dailySpendingLimit?.toString() ?? ''}
                onChange={(value) =>
                  setControlForm({
                    ...controlForm,
                    dailySpendingLimit: value ? Number(value) : undefined,
                  })
                }
              />
              <TextInput
                label="Blocked categories"
                value={controlForm.blockedCategories?.join(', ') ?? ''}
                onChange={(value) =>
                  setControlForm({
                    ...controlForm,
                    blockedCategories: splitCsv(value),
                  })
                }
              />
              <TextInput
                label="Blocked menu item IDs"
                value={controlForm.blockedMenuItemIds?.join(', ') ?? ''}
                onChange={(value) =>
                  setControlForm({
                    ...controlForm,
                    blockedMenuItemIds: splitCsv(value),
                  })
                }
              />
              <TextInput
                label="Low balance threshold"
                type="number"
                value={controlForm.lowBalanceThreshold?.toString() ?? ''}
                onChange={(value) =>
                  setControlForm({
                    ...controlForm,
                    lowBalanceThreshold: value ? Number(value) : undefined,
                  })
                }
              />
              <button type="submit" className="btn-primary w-full" disabled={controlMutation.isPending}>
                {controlMutation.isPending ? 'Saving...' : 'Save control'}
              </button>
            </form>
          </Panel>
        </TwoColumn>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Panel title="Report filters" description="Reports are backend-generated; frontend displays returned totals and downloads audited CSV exports.">
            <div className="grid gap-4 lg:grid-cols-3">
              <TextInput label="Daily meal date" type="date" value={reportDate} onChange={setReportDate} />
              <TextInput label="Report range from" type="date" value={reportFrom} onChange={setReportFrom} />
              <TextInput label="Report range to" type="date" value={reportTo} onChange={setReportTo} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2"
                disabled={dailyMealCsvMutation.isPending}
                onClick={() => dailyMealCsvMutation.mutate()}
                data-testid="canteen-daily-meal-csv-export"
              >
                <Download className="h-4 w-4" />
                {dailyMealCsvMutation.isPending ? 'Exporting...' : 'Export daily meal CSV'}
              </button>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-2"
                disabled={itemSalesCsvMutation.isPending}
                onClick={() => itemSalesCsvMutation.mutate()}
                data-testid="canteen-item-sales-csv-export"
              >
                <Download className="h-4 w-4" />
                {itemSalesCsvMutation.isPending ? 'Exporting...' : 'Export item sales CSV'}
              </button>
            </div>
            {dailyMealCsvMutation.error ? <InlineError message={dailyMealCsvMutation.error.message} /> : null}
            {itemSalesCsvMutation.error ? <InlineError message={itemSalesCsvMutation.error.message} /> : null}
          </Panel>
          <div className="grid gap-6 xl:grid-cols-3">
            <ReportPanel title="Daily meal count" loading={mealCountQuery.isLoading} rows={(mealCountQuery.data ?? []).map((row) => `${row.mealType} • ${row.status}: ${row._count._all}`)} />
            <ReportPanel title="Item-wise sales" loading={itemSalesQuery.isLoading} rows={(itemSalesQuery.data ?? []).map((row) => `${row.itemName}: ${row._sum.quantity ?? 0} sold • ${money(row._sum.lineTotal ?? 0)}`)} />
            <ReportPanel title="Student spending" loading={spendingSummaryQuery.isLoading} rows={(spendingSummaryQuery.data ?? []).map((row) => `${row.studentId.slice(0, 8)}: ${money(row._sum.totalAmount ?? 0)} • ${row._count._all} sales`)} />
          </div>
          <LowBalanceList wallets={lowBalanceWallets} />
          <Panel title="Stock ledger" description="Recent stock movement report from the backend.">
            {stockLedgerQuery.isLoading ? <LoadingState label="Loading stock ledger..." /> : null}
            {!stockLedgerQuery.isLoading && stockLedgerRows.length === 0 ? (
              <EmptyState title="No stock movement" description="No stock movement rows returned for the selected range." />
            ) : null}
            <div className="space-y-2">
              {stockLedgerRows.slice(0, 10).map((row, index) => (
                <div key={row.id ?? `${row.inventoryItemId}-${row.movementDate}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <Package className="h-5 w-5 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{row.inventoryItem?.name ?? row.inventoryItemId ?? 'Inventory item'}</p>
                      <p className="text-xs text-slate-500">{row.type ?? 'Movement'} - {row.reason ?? row.referenceType ?? 'No reason recorded'}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                    <p>{Number(row.quantity ?? 0).toLocaleString()} {row.inventoryItem?.unit ?? ''}</p>
                    <p>Balance {Number(row.balanceAfter ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
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
        description={confirmingSaleId?.startsWith('cancel:') ? 'This marks the draft sale as cancelled. Use this only when the canteen transaction should not be collected.' : 'This completes the sale using backend wallet, spending-limit, and payment checks. Review student warnings before continuing.'}
        confirmLabel={confirmingSaleId?.startsWith('cancel:') ? 'Cancel sale' : 'Complete sale'}
        variant={confirmingSaleId?.startsWith('cancel:') ? 'destructive' : 'default'}
        isConfirming={completeSaleMutation.isPending || cancelSaleMutation.isPending}
      />
    </div>
  );
}

function TwoColumn({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">{children}</div>;
}
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Notice({ tone, message, onDismiss }: { tone: 'success' | 'error'; message: string; onDismiss?: () => void }) {
  return (
    <div className={cn('flex items-center justify-between rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700')}>
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="font-semibold" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
function InfoCard({ lines }: { lines: string[] }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
function RecordCard({ title, subtitle, action, badge }: { title: string; subtitle: string; action?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
    </div>
  );
}
function SaleList({
  sales,
  emptyTitle,
  onComplete,
  onCancel,
  onReceipt,
  onReceiptPdf,
  receiptLoadingSaleId,
}: {
  sales: Array<{
    id: string;
    status: string;
    paymentMethod: string;
    totalAmount: string | number;
    receiptNumber?: string | null;
    studentId?: string | null;
    items?: Array<{ itemName: string; quantity: number }>;
  }>;
  emptyTitle: string;
  onComplete?: (saleId: string) => void;
  onCancel?: (saleId: string) => void;
  onReceipt?: (saleId: string) => void;
  onReceiptPdf?: (saleId: string) => void;
  receiptLoadingSaleId?: string;
}) {
  if (sales.length === 0) {
    return <EmptyState title={emptyTitle} description="Canteen sales will appear here." />;
  }

  return (
    <div className="space-y-3">
      {sales.map((sale) => {
        const completed = sale.status === 'COMPLETED';
        const loadingReceipt = receiptLoadingSaleId === sale.id;

        return (
          <RecordCard
            key={sale.id}
            title={`${sale.paymentMethod} • ${money(sale.totalAmount)}`}
            subtitle={`${sale.receiptNumber ? `${sale.receiptNumber} • ` : ''}${sale.items?.map((item) => `${item.itemName} x${item.quantity}`).join(', ') || sale.studentId || 'Walk-in sale'}`}
            badge={<CanteenStatusBadge status={sale.status} />}
            action={
              sale.status === 'DRAFT' ? (
                <div className="flex gap-2">
                  {onComplete ? (
                    <button type="button" className="btn-primary" onClick={() => onComplete(sale.id)}>
                      Complete
                    </button>
                  ) : null}
                  {onCancel ? (
                    <button type="button" className="btn-secondary" onClick={() => onCancel(sale.id)}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : completed ? (
                <div className="flex gap-2">
                  {onReceipt ? (
                    <button type="button" className="btn-secondary" disabled={loadingReceipt} onClick={() => onReceipt(sale.id)}>
                      {loadingReceipt ? 'Loading...' : 'Preview'}
                    </button>
                  ) : null}
                  {onReceiptPdf ? (
                    <button type="button" className="btn-primary" disabled={loadingReceipt} onClick={() => onReceiptPdf(sale.id)}>
                      PDF
                    </button>
                  ) : null}
                </div>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
function ReceiptPreview({ receipt }: { receipt: CanteenPosReceipt }) {
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{receipt.receiptNumber ?? receipt.saleId}</h3>
          <p className="text-sm text-slate-500">
            {receipt.school.name} • {new Date(receipt.saleDate).toLocaleString()}
          </p>
        </div>
        <CanteenStatusBadge status="COMPLETED" />
      </div>
      <div className="mt-4 space-y-2">
        {receipt.items.map((item) => (
          <div key={`${item.name}-${item.quantity}-${item.lineTotal}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span>
              {item.quantity} x {item.name}
            </span>
            <span className="font-bold text-slate-900">{money(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
        <ReceiptTotalRow label="Subtotal" value={receipt.subtotal} />
        <ReceiptTotalRow label="Discount" value={receipt.discountAmount} />
        <ReceiptTotalRow label="Total" value={receipt.totalAmount} strong />
        {receipt.walletBalanceAfter ? <ReceiptTotalRow label="Wallet balance" value={receipt.walletBalanceAfter} /> : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {receipt.student?.name ?? receipt.staff?.name ?? 'Walk-in sale'} • {receipt.paymentMethod} • cashier {receipt.cashier ?? 'Cashier not recorded'}
      </p>
    </section>
  );
}
function ReceiptTotalRow({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', strong ? 'text-base font-black text-slate-950' : 'text-slate-600')}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}
function InlineError({ message }: { message: string }) {
  return <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}
function LowBalanceList({
  wallets,
}: {
  wallets: Array<{
    id: string;
    balance: string | number;
    lowBalanceThreshold: string | number;
    studentId: string;
    student?: {
      firstNameEn?: string;
      lastNameEn?: string;
      studentSystemId?: string;
    } | null;
  }>;
}) {
  if (wallets.length === 0) return <EmptyState title="No low balance wallets" description="Low balance wallet report returned no students." />;
  return (
    <Panel title="Low-balance wallets" description="Students returned by the backend low-balance wallet report.">
      <div className="space-y-3">
        {wallets.map((wallet) => (
          <RecordCard key={wallet.id} title={studentLabel(wallet.student) || wallet.studentId} subtitle={`Balance ${money(wallet.balance)} • threshold ${money(wallet.lowBalanceThreshold)}`} badge={<CanteenStatusBadge status="WALLET_LOW" />} />
        ))}
      </div>
    </Panel>
  );
}
function ReportPanel({ title, loading, rows }: { title: string; loading: boolean; rows: string[] }) {
  return (
    <Panel title={title} description="Backend report result.">
      {loading ? (
        <LoadingState label="Loading report..." />
      ) : rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <p key={row} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {row}
            </p>
          ))}
        </div>
      ) : (
        <EmptyState title="No data" description="No report rows returned." />
      )}
    </Panel>
  );
}
function CanteenQrStudentCard({
  student,
  context,
}: {
  student: CanteenQrStudent;
  context: 'serving' | 'pos';
}) {
  const walletStatus = student.walletStatus ?? (student.canPurchase === false ? 'INSUFFICIENT_FUNDS' : 'ACTIVE');
  const allergies = student.allergyWarnings ?? [];

  return (
    <div className="mb-6 rounded-2xl border border-[var(--color-mod-canteen-border)] bg-[var(--color-mod-canteen-bg)]/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--color-mod-canteen-text)]">
            {context === 'pos' ? 'POS QR student selected' : 'Serving QR student selected'}
          </p>
          <h3 className="mt-1 truncate font-black text-slate-900">{student.name ?? 'Student'}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {[student.studentCode, student.classSection].filter(Boolean).join(' • ') || 'Student QR resolved'}
          </p>
        </div>
        <StatusBadge
          status={walletStatus}
          label={formatStatus(walletStatus)}
          tone={canteenQrWalletTone(walletStatus)}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs font-bold sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3 text-slate-600 shadow-sm">
          <p className="text-slate-400">Wallet balance</p>
          <p className="mt-1 text-base text-slate-900">
            {student.walletBalance !== undefined && student.walletBalance !== null
              ? money(student.walletBalance)
              : 'Not loaded'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 text-slate-600 shadow-sm">
          <p className="text-slate-400">Allergy warnings</p>
          <p className={cn('mt-1 text-base', allergies.length > 0 ? 'text-red-600' : 'text-slate-900')}>
            {allergies.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 text-slate-600 shadow-sm">
          <p className="text-slate-400">Purchase status</p>
          <p className={cn('mt-1 text-base', student.canPurchase === false ? 'text-red-600' : 'text-slate-900')}>
            {student.canPurchase === false ? 'Blocked' : 'Allowed'}
          </p>
        </div>
      </div>

      {allergies.length > 0 ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          Allergies: {allergies.join(', ')}
        </div>
      ) : null}
      {student.spendingWarnings ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          {student.spendingWarnings}
        </div>
      ) : null}
    </div>
  );
}
function TextInput({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1" />
    </label>
  );
}
function SelectInput({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="input-control mt-1">
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function StudentSelect({
  value,
  onChange,
  students,
  optional,
}: {
  value: string;
  onChange: (value: string) => void;
  students: Array<{
    id: string;
    firstNameEn?: string;
    lastNameEn?: string;
    studentSystemId?: string;
  }>;
  optional?: boolean;
}) {
  return (
    <SelectInput
      label={optional ? 'Student (optional)' : 'Student'}
      value={value}
      onChange={onChange}
      required={!optional}
      options={students.map((student) => ({
        label: studentLabel(student) || student.id,
        value: student.id,
      }))}
    />
  );
}
function mealTypeOptions() {
  return [
    { label: 'Breakfast', value: 'BREAKFAST' },
    { label: 'Lunch', value: 'LUNCH' },
    { label: 'Snacks', value: 'SNACKS' },
    { label: 'Dinner', value: 'DINNER' },
    { label: 'Hostel meal', value: 'HOSTEL' },
  ];
}
function studentLabel(
  student?: {
    firstNameEn?: string;
    lastNameEn?: string;
    studentSystemId?: string;
  } | null,
) {
  if (!student) return '';
  return `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''} ${student.studentSystemId ? `(${student.studentSystemId})` : ''}`.trim();
}
function money(value: string | number | null | undefined) {
  return moneyFormatter.format(Number(value ?? 0));
}
function formatQuantity(value: string | number | null | undefined, unit: string) {
  const numeric = Number(value ?? 0);
  const formatted = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
  return `${formatted}${unit ? ` ${unit}` : ''}`;
}
function isWalletLow(balance: string | number, threshold: string | number) {
  return Number(balance) <= Number(threshold);
}
function canteenQrWalletTone(status: string): StatusTone {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'approved';
  if (normalized === 'LOW_BALANCE') return 'pending';
  if (normalized === 'INSUFFICIENT_FUNDS') return 'conflict';
  return 'info';
}
function CanteenStatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const badgeMap: Record<string, { label: string; tone: StatusTone }> = {
    SERVED: { label: 'Meal Served', tone: 'approved' },
    MEAL_SERVED: { label: 'Meal Served', tone: 'approved' },
    NOT_TAKEN: { label: 'Not Served', tone: 'pending' },
    ABSENT: { label: 'Not Served', tone: 'pending' },
    NOT_SERVED: { label: 'Not Served', tone: 'pending' },
    WALLET_LOW: { label: 'Wallet Low', tone: 'pending' },
    BLOCKED_BY_PARENT_LIMIT: {
      label: 'Blocked by Parent Limit',
      tone: 'conflict',
    },
    ALLERGY_WARNING: { label: 'Allergy Warning', tone: 'conflict' },
    ACTIVE: { label: 'Active', tone: 'active' },
    INACTIVE: { label: 'Inactive', tone: 'inactive' },
    DRAFT: { label: 'Draft', tone: 'draft' },
    COMPLETED: { label: 'Completed', tone: 'approved' },
    CANCELLED: { label: 'Cancelled', tone: 'inactive' },
    PAUSED: { label: 'Inactive', tone: 'inactive' },
    ENDED: { label: 'Completed', tone: 'approved' },
  };
  const config = badgeMap[normalized] ?? {
    label: formatStatus(normalized),
    tone: 'info' as StatusTone,
  };
  return <StatusBadge status={normalized} label={config.label} tone={config.tone} />;
}
function formatStatus(status: string) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
function itemsFromResult<T>(result?: T[] | { items?: T[] } | null) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.items ?? [];
}
function cleanMenu(form: CanteenMenuItemPayload): CanteenMenuItemPayload {
  return {
    ...form,
    description: form.description || undefined,
    allergenTags: form.allergenTags ?? [],
  };
}
function cleanPlan(form: CanteenMealPlanPayload): CanteenMealPlanPayload {
  return {
    ...form,
    description: form.description || undefined,
    billingFrequency: form.billingFrequency || undefined,
  };
}
function cleanEnrollment(form: CanteenEnrollmentPayload): CanteenEnrollmentPayload {
  return {
    ...form,
    endsOn: form.endsOn || undefined,
    notes: form.notes || undefined,
  };
}
function cleanServing(form: CanteenMealServingPayload): CanteenMealServingPayload {
  return {
    ...form,
    enrollmentId: form.enrollmentId || undefined,
    mealPlanId: form.mealPlanId || undefined,
    notes: form.notes || undefined,
  };
}
function cleanTopUp(form: CanteenTopUpPayload): CanteenTopUpPayload {
  return { ...form, note: form.note || undefined };
}
function cleanPos(form: CanteenPosSalePayload): CanteenPosSalePayload {
  return {
    ...form,
    studentId: form.studentId || undefined,
    staffId: form.staffId || undefined,
    notes: form.notes || undefined,
    items: form.items.filter((item) => item.menuItemId && item.quantity > 0),
  };
}
function cleanControl(form: CanteenSpendingControlPayload): CanteenSpendingControlPayload {
  return {
    ...form,
    blockedCategories: form.blockedCategories ?? [],
    blockedMenuItemIds: form.blockedMenuItemIds ?? [],
  };
}
function cleanSupplierPayload(form: CanteenSupplierPayload): CanteenSupplierPayload {
  return {
    name: form.name.trim(),
    contactName: form.contactName?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    email: form.email?.trim() || undefined,
    address: form.address?.trim() || undefined,
    panNumber: form.panNumber?.trim() || undefined,
  };
}
function cleanInventoryItemPayload(form: CanteenInventoryItemPayload): CanteenInventoryItemPayload {
  return {
    name: form.name.trim(),
    sku: form.sku?.trim() || undefined,
    category: form.category.trim(),
    unit: form.unit || 'pcs',
    minStockLevel: Number(form.minStockLevel ?? 0),
    unitCost: Number(form.unitCost ?? 0),
    defaultSupplierId: form.defaultSupplierId || undefined,
  };
}
function updateFirstPurchaseBillItem(form: CanteenPurchaseBillPayload, patch: Partial<CanteenPurchaseBillPayload['items'][number]>): CanteenPurchaseBillPayload {
  const current = form.items[0] ?? emptyPurchaseBillForm.items[0];

  return {
    ...form,
    items: [{ ...current, ...patch }],
  };
}
function cleanPurchaseBillPayload(form: CanteenPurchaseBillPayload): CanteenPurchaseBillPayload {
  const item = form.items[0] ?? emptyPurchaseBillForm.items[0];

  return {
    supplierId: form.supplierId,
    billNumber: form.billNumber.trim(),
    billDate: form.billDate,
    taxAmount: Number(form.taxAmount ?? 0),
    discountAmount: Number(form.discountAmount ?? 0),
    notes: form.notes?.trim() || undefined,
    items: [
      {
        inventoryItemId: item.inventoryItemId,
        quantity: Number(item.quantity ?? 0),
        unitCost: Number(item.unitCost ?? 0),
        expiryDate: item.expiryDate || undefined,
        batchNumber: item.batchNumber?.trim() || undefined,
      },
    ],
  };
}
function cleanWastagePayload(form: CanteenWastagePayload): CanteenWastagePayload {
  return {
    inventoryItemId: form.inventoryItemId,
    quantity: Number(form.quantity ?? 0),
    reason: form.reason.trim(),
    wastageDate: form.wastageDate,
    notes: form.notes?.trim() || undefined,
  };
}
function cleanStockAdjustmentPayload(form: CanteenStockAdjustmentPayload): CanteenStockAdjustmentPayload {
  return {
    inventoryItemId: form.inventoryItemId,
    quantity: Number(form.quantity ?? 0),
    reason: form.reason.trim(),
  };
}
