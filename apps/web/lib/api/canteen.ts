import {
  API_BASE_URL,
  downloadCsv,
  JsonBody,
  openPdfBlob,
  request,
  withQuery,
} from './client';

export type CanteenMenuItemStatus = 'ACTIVE' | 'INACTIVE';
export type CanteenMealPlanStatus = 'ACTIVE' | 'INACTIVE';
export type CanteenEnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'ENDED';
export type CanteenMealServingStatus = 'SERVED' | 'NOT_TAKEN' | 'ABSENT' | 'CANCELLED';
export type CanteenWalletTransactionType = 'TOP_UP' | 'DEDUCTION' | 'REFUND' | 'ADJUSTMENT';
export type CanteenWalletTransactionSource = 'MANUAL' | 'POS_SALE' | 'MEAL_PURCHASE' | 'FEE_INTEGRATION' | 'ACCOUNTING_ADJUSTMENT';
export type CanteenPosSaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type CanteenPaymentMethod = 'CASH' | 'WALLET' | 'STAFF_CREDIT';

export type CanteenStudentSummary = {
  id: string;
  studentSystemId?: string;
  firstNameEn?: string;
  lastNameEn?: string;
};

export type CanteenMenuItem = {
  id: string;
  tenantId?: string;
  name: string;
  category: string;
  description?: string | null;
  unitPrice: string | number;
  status: CanteenMenuItemStatus;
  isMealItem: boolean;
  allergenTags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CanteenMealPlan = {
  id: string;
  tenantId?: string;
  name: string;
  description?: string | null;
  mealType: string;
  price: string | number;
  billingFrequency: string;
  status: CanteenMealPlanStatus;
  duplicateServingPrevention: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CanteenStudentEnrollment = {
  id: string;
  tenantId?: string;
  studentId: string;
  mealPlanId: string;
  startsOn: string;
  endsOn?: string | null;
  status: CanteenEnrollmentStatus;
  feeInvoiceId?: string | null;
  feePostedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  student?: CanteenStudentSummary;
  mealPlan?: CanteenMealPlan;
};

export type CanteenMealServing = {
  id: string;
  tenantId?: string;
  studentId: string;
  enrollmentId?: string | null;
  mealPlanId?: string | null;
  mealType: string;
  mealDate: string;
  servedAt: string;
  status: CanteenMealServingStatus;
  dietaryWarning?: string | null;
  notes?: string | null;
  student?: CanteenStudentSummary;
  mealPlan?: CanteenMealPlan | null;
};

export type CanteenWallet = {
  id: string;
  tenantId?: string;
  studentId: string;
  balance: string | number;
  lowBalanceThreshold: string | number;
  createdAt?: string;
  updatedAt?: string;
  student?: CanteenStudentSummary;
};

export type CanteenWalletTransaction = {
  id: string;
  tenantId?: string;
  walletId: string;
  studentId: string;
  type: CanteenWalletTransactionType;
  source: CanteenWalletTransactionSource;
  amount: string | number;
  balanceAfter: string | number;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  reversalOfId?: string | null;
  transactionDate: string;
};

export type CanteenPosSaleItem = {
  id: string;
  tenantId?: string;
  saleId: string;
  menuItemId: string;
  itemName: string;
  category: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
};

export type CanteenPosSale = {
  id: string;
  tenantId?: string;
  studentId?: string | null;
  staffId?: string | null;
  walletId?: string | null;
  saleDate: string;
  paymentMethod: CanteenPaymentMethod;
  status: CanteenPosSaleStatus;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  completedAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  items?: CanteenPosSaleItem[];
  student?: CanteenStudentSummary | null;
};

export type CanteenPosReceipt = {
  school: {
    name: string;
    panNumber?: string | null;
  };
  receiptNumber?: string | null;
  saleId: string;
  saleDate: string;
  paymentMethod: CanteenPaymentMethod;
  cashier?: string | null;
  student?: {
    id: string;
    studentSystemId?: string | null;
    name: string;
  } | null;
  staff?: { id: string; employeeId?: string | null; name: string } | null;
  items: Array<{
    name: string;
    category: string;
    quantity: number;
    unitPrice: string | number;
    lineTotal: string | number;
  }>;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  walletBalanceAfter?: string | number | null;
};

export type CanteenSpendingControl = {
  id: string;
  tenantId?: string;
  studentId: string;
  dailySpendingLimit?: string | number | null;
  blockedCategories: string[];
  blockedMenuItemIds: string[];
  lowBalanceThreshold?: string | number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CanteenPaginatedResult<T> = {
  items: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
};

export type CanteenSupplier = {
  id: string;
  tenantId?: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  panNumber?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CanteenInventoryItem = {
  id: string;
  tenantId?: string;
  name: string;
  sku?: string | null;
  category: string;
  unit: string;
  currentStock: string | number;
  minStockLevel: string | number;
  unitCost: string | number;
  defaultSupplierId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CanteenStockLedgerRow = {
  id?: string;
  tenantId?: string;
  inventoryItemId?: string;
  type?: string;
  quantity?: string | number;
  balanceAfter?: string | number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  movementDate?: string;
  inventoryItem?: Pick<CanteenInventoryItem, 'id' | 'name' | 'unit'> | null;
};

export type CanteenMenuItemPayload = {
  name: string;
  category: string;
  description?: string;
  unitPrice: number;
  isMealItem?: boolean;
  allergenTags?: string[];
};

export type CanteenMealPlanPayload = {
  name: string;
  description?: string;
  mealType: string;
  price: number;
  billingFrequency?: string;
  duplicateServingPrevention?: boolean;
};

export type CanteenEnrollmentPayload = {
  studentId: string;
  mealPlanId: string;
  startsOn: string;
  endsOn?: string;
  notes?: string;
};

export type CanteenMealServingPayload = {
  studentId: string;
  enrollmentId?: string;
  mealPlanId?: string;
  mealType?: string;
  mealDate?: string;
  preventDuplicate?: boolean;
  notes?: string;
};

export type CanteenTopUpPayload = {
  amount: number;
  note?: string;
  lowBalanceThreshold?: number;
};

export type CanteenPosSalePayload = {
  studentId?: string;
  staffId?: string;
  paymentMethod: CanteenPaymentMethod;
  notes?: string;
  items: { menuItemId: string; quantity: number }[];
};

export type CanteenSpendingControlPayload = {
  studentId: string;
  dailySpendingLimit?: number;
  blockedCategories?: string[];
  blockedMenuItemIds?: string[];
  lowBalanceThreshold?: number;
  isActive?: boolean;
};

export type CanteenSupplierPayload = {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  panNumber?: string;
};

export type CanteenInventoryItemPayload = {
  name: string;
  sku?: string;
  category: string;
  unit: string;
  minStockLevel?: number;
  unitCost?: number;
  defaultSupplierId?: string;
};

export type CanteenPurchaseBillItemPayload = {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  expiryDate?: string;
  batchNumber?: string;
};

export type CanteenPurchaseBillPayload = {
  supplierId: string;
  billNumber: string;
  billDate: string;
  taxAmount?: number;
  discountAmount?: number;
  notes?: string;
  items: CanteenPurchaseBillItemPayload[];
};

export type CanteenPurchaseBill = {
  id: string;
  tenantId?: string;
  supplierId: string;
  billNumber: string;
  billDate: string;
  totalAmount: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  netAmount: string | number;
  notes?: string | null;
  items?: Array<
    CanteenPurchaseBillItemPayload & {
      id?: string;
      lineTotal?: string | number;
    }
  >;
};

export type CanteenWastagePayload = {
  inventoryItemId: string;
  quantity: number;
  reason: string;
  wastageDate: string;
  notes?: string;
};

export type CanteenStockAdjustmentPayload = {
  inventoryItemId: string;
  quantity: number;
  reason: string;
};

export type DailyMealCountReport = {
  mealType: string;
  status: CanteenMealServingStatus;
  _count: { _all: number };
};

export type ItemWiseSalesReport = {
  menuItemId: string;
  itemName: string;
  category: string;
  _sum: {
    quantity: number | null;
    lineTotal: string | number | null;
  };
};

export type StudentSpendingSummary = {
  studentId: string;
  _sum: {
    totalAmount: string | number | null;
  };
  _count: {
    _all: number;
  };
};

export const canteenApi = {
  listMenuItems: (params?: { q?: string | null; category?: string | null; status?: string | null }) => request<CanteenMenuItem[]>(withQuery('/canteen/menu-items', params ?? {})),
  createMenuItem: (body: CanteenMenuItemPayload) =>
    request<CanteenMenuItem>('/canteen/menu-items', {
      method: 'POST',
      json: body,
    }),
  updateMenuItem: (itemId: string, body: Partial<CanteenMenuItemPayload>) => request<CanteenMenuItem>(`/canteen/menu-items/${encodeURIComponent(itemId)}`, { method: 'PATCH', json: body }),
  updateMenuItemStatus: (itemId: string, body: { status: CanteenMenuItemStatus; reason?: string }) => request<CanteenMenuItem>(`/canteen/menu-items/${encodeURIComponent(itemId)}/status`, { method: 'PATCH', json: body }),
  listMealPlans: (params?: { q?: string | null; status?: string | null }) => request<CanteenMealPlan[]>(withQuery('/canteen/meal-plans', params ?? {})),
  createMealPlan: (body: CanteenMealPlanPayload) =>
    request<CanteenMealPlan>('/canteen/meal-plans', {
      method: 'POST',
      json: body,
    }),
  updateMealPlan: (planId: string, body: Partial<CanteenMealPlanPayload>) => request<CanteenMealPlan>(`/canteen/meal-plans/${encodeURIComponent(planId)}`, { method: 'PATCH', json: body }),
  updateMealPlanStatus: (planId: string, body: { status: CanteenMealPlanStatus; reason?: string }) => request<CanteenMealPlan>(`/canteen/meal-plans/${encodeURIComponent(planId)}/status`, { method: 'PATCH', json: body }),
  listEnrollments: (params?: { studentId?: string | null; status?: string | null }) => request<CanteenStudentEnrollment[]>(withQuery('/canteen/enrollments', params ?? {})),
  createEnrollment: (body: CanteenEnrollmentPayload) =>
    request<CanteenStudentEnrollment>('/canteen/enrollments', {
      method: 'POST',
      json: body,
    }),
  updateEnrollment: (
    enrollmentId: string,
    body: Partial<CanteenEnrollmentPayload> & {
      status?: CanteenEnrollmentStatus;
    },
  ) => request<CanteenStudentEnrollment>(`/canteen/enrollments/${encodeURIComponent(enrollmentId)}`, { method: 'PATCH', json: body }),
  cancelEnrollment: (enrollmentId: string, body?: { reason?: string }) => request<CanteenStudentEnrollment>(`/canteen/enrollments/${encodeURIComponent(enrollmentId)}/cancel`, { method: 'PATCH', json: body ?? {} }),
  serveMeal: (body: CanteenMealServingPayload) =>
    request<CanteenMealServing>('/canteen/servings', {
      method: 'POST',
      json: body,
    }),
  listServings: (params?: { studentId?: string | null; date?: string | null }) => request<CanteenMealServing[]>(withQuery('/canteen/servings', params ?? {})),
  getOrCreateWallet: (studentId: string) => request<CanteenWallet>(`/canteen/wallets/student/${encodeURIComponent(studentId)}`, { method: 'POST', json: {} }),
  getWalletBalance: (studentId: string) => request<CanteenWallet>(`/canteen/wallets/student/${encodeURIComponent(studentId)}/balance`),
  topUpWallet: (studentId: string, body: CanteenTopUpPayload) => request<CanteenWalletTransaction>(`/canteen/wallets/student/${encodeURIComponent(studentId)}/top-up`, { method: 'POST', json: body }),
  listWalletTransactions: (studentId: string) =>
    request<CanteenPaginatedResult<CanteenWalletTransaction>>(
      `/canteen/wallets/student/${encodeURIComponent(studentId)}/transactions`,
    ),
  reverseWalletTransaction: (transactionId: string, body: { reason: string }) => request<CanteenWalletTransaction>(`/canteen/wallets/transactions/${encodeURIComponent(transactionId)}/reverse`, { method: 'POST', json: body }),
  correctWalletTransaction: (transactionId: string, body: { amount: number; reason: string; note?: string }) => request<CanteenWalletTransaction>(`/canteen/wallets/transactions/${encodeURIComponent(transactionId)}/correct`, { method: 'POST', json: body }),
  createPosSale: (body: CanteenPosSalePayload) =>
    request<CanteenPosSale>('/canteen/pos-sales', {
      method: 'POST',
      json: body,
    }),
  completePosSale: (saleId: string, body?: { note?: string }) => request<CanteenPosSale>(`/canteen/pos-sales/${encodeURIComponent(saleId)}/complete`, { method: 'PATCH', json: body ?? {} }),
  cancelPosSale: (saleId: string, body?: { reason?: string }) => request<CanteenPosSale>(`/canteen/pos-sales/${encodeURIComponent(saleId)}/cancel`, { method: 'PATCH', json: body ?? {} }),
  listPosSales: (params?: { studentId?: string | null; status?: string | null; date?: string | null }) => request<CanteenPosSale[]>(withQuery('/canteen/pos-sales', params ?? {})),
  getPosReceipt: (saleId: string) => request<CanteenPosReceipt>(`/canteen/pos-sales/${encodeURIComponent(saleId)}/receipt`),
  openPosReceiptPdf: async (saleId: string) => {
    const response = await fetch(`${API_BASE_URL}/canteen/pos-sales/${encodeURIComponent(saleId)}/receipt.pdf`, { credentials: 'include' });
    await openPdfBlob(response);
  },
  upsertSpendingControl: (body: CanteenSpendingControlPayload) =>
    request<CanteenSpendingControl>('/canteen/spending-controls', {
      method: 'POST',
      json: body,
    }),
  getSpendingControl: (studentId: string) => request<CanteenSpendingControl | null>(`/canteen/spending-controls/student/${encodeURIComponent(studentId)}`),
  listSuppliers: (params?: { page?: number; limit?: number }) => request<CanteenPaginatedResult<CanteenSupplier>>(withQuery('/canteen/suppliers', params ?? {})),
  createSupplier: (body: CanteenSupplierPayload) =>
    request<CanteenSupplier>('/canteen/suppliers', {
      method: 'POST',
      json: body,
    }),
  listInventoryItems: (params?: { category?: string | null; page?: number; limit?: number }) => request<CanteenPaginatedResult<CanteenInventoryItem>>(withQuery('/canteen/inventory-items', params ?? {})),
  createInventoryItem: (body: CanteenInventoryItemPayload) =>
    request<CanteenInventoryItem>('/canteen/inventory-items', {
      method: 'POST',
      json: body,
    }),
  createPurchaseBill: (body: CanteenPurchaseBillPayload) =>
    request<CanteenPurchaseBill>('/canteen/purchase-bills', {
      method: 'POST',
      json: body,
    }),
  recordWastage: (body: CanteenWastagePayload) =>
    request<unknown>('/canteen/wastage', {
      method: 'POST',
      json: body,
    }),
  adjustStock: (body: CanteenStockAdjustmentPayload) =>
    request<CanteenStockLedgerRow>('/canteen/stock-adjustment', {
      method: 'POST',
      json: body,
    }),
  getDailyMealCountReport: (params?: { date?: string | null }) => request<DailyMealCountReport[]>(withQuery('/canteen/reports/daily-meal-count', params ?? {})),
  downloadDailyMealCountCsv: (params?: { date?: string | null }) =>
    downloadCsv(
      withQuery('/canteen/reports/daily-meal-count.csv', params ?? {}),
      'canteen-daily-meal-count.csv',
    ),
  getItemWiseSalesReport: (params?: { from?: string | null; to?: string | null }) => request<ItemWiseSalesReport[]>(withQuery('/canteen/reports/item-wise-sales', params ?? {})),
  downloadItemWiseSalesCsv: (params?: { from?: string | null; to?: string | null }) =>
    downloadCsv(
      withQuery('/canteen/reports/item-wise-sales.csv', params ?? {}),
      'canteen-item-wise-sales.csv',
    ),
  getLowBalanceWallets: (params?: { threshold?: number | null }) => request<CanteenWallet[]>(withQuery('/canteen/reports/low-balance-wallets', params ?? {})),
  getStudentSpendingSummary: (params?: { studentId?: string | null; from?: string | null; to?: string | null }) => request<StudentSpendingSummary[]>(withQuery('/canteen/reports/student-spending-summary', params ?? {})),
  getStockLedger: (params?: { inventoryItemId?: string | null; from?: string | null; to?: string | null }) => request<CanteenStockLedgerRow[]>(withQuery('/canteen/reports/stock-ledger', params ?? {})),
};
