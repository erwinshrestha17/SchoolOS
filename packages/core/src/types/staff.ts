import type {
  PayrollLineSummary,
  PayrollMoneyAmount,
  SalaryStructureSummary,
} from "./payroll.js";

export type StaffSummary = {
  id: string;
  employeeId: string;
  staffCode?: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  roles: string[];
  joiningDate: string;
  contractType: string;
  status?: string;
  department?: string | null;
  designation?: string | null;
  address?: string;
  bankName?: string;
  bankAccount?: string;
  photoUrl?: string | null;
  user?: {
    email: string;
    userRoles: Array<{ role: { name: string } }>;
  };
  staffContracts?: StaffContractSummary[];
};

export type StaffLookupOption = {
  id: string;
  employeeId: string;
  staffCode: string | null;
  fullName: string;
  department: string | null;
  designation: string | null;
};

export type StaffAttendanceRosterItem = {
  staffId: string;
  employeeId: string;
  fullName: string;
};

export type StaffAttendanceRosterPage = {
  items: StaffAttendanceRosterItem[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
};

export type StaffDetail = StaffSummary & {
  allowedSensitiveFields?: {
    identityRead: boolean;
    identityWrite: boolean;
    bankRead: boolean;
    bankWrite: boolean;
    taxRead: boolean;
    taxWrite: boolean;
    documentsRead: boolean;
    documentsManage: boolean;
    salaryRead: boolean;
    disciplinaryRead: boolean;
    medicalRead: boolean;
    safeguardingRead: boolean;
    attendanceRead: boolean;
    leaveRead: boolean;
  };
  personal?: {
    dateOfBirth: string;
    gender: string;
    address: string;
    emergencyContact?: {
      name?: string | null;
      phone?: string | null;
      relation?: string | null;
    };
  };
  employment?: {
    department?: string | null;
    designation?: string | null;
    employmentType?: string | null;
    joiningDate: string;
    contractStatus?: string | null;
    teacherRegistryId?: string | null;
  };
  salaryStructures?: SalaryStructureSummary[];
  attendanceRecords?: unknown[];
  leaveBalances?: StaffLeaveBalanceSummary[];
  leaveRequests?: StaffLeaveRequestSummary[];
  payrollLines?: PayrollLineSummary[];
};

/** Phase 7.6 (D5): a full day, or one half of a single school day. */
export type StaffLeaveDayPart = "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF";

export type StaffLeaveRequestSummary = {
  id: string;
  staffId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number;
  dayPart?: StaffLeaveDayPart;
  isPaid?: boolean;
  reason: string;
  status: string;
  reviewedAt: string | null;
  staff?: StaffSummary;
};

export type StaffLeaveBalanceSummary = {
  id: string;
  staffId: string;
  leaveType: string;
  year: number;
  entitlement: number;
  carriedForward: number;
  used: number;
  pending: number;
  remaining: number;
  staff?: StaffSummary;
};

/** Response of every leave review route (the reviewed request, flattened). */
export type StaffLeaveReviewResult = StaffLeaveRequestSummary & {
  /** Days where existing attendance was kept instead of being marked LEAVE. */
  overlapAnomalies: Array<{
    date: string;
    existingStatus: string;
  }>;
  /** Timetable cover drafts created in the approval transaction. */
  coverage: { created: number };
};

/** One timetabled period affected by staff leave. */
export type StaffLeaveCoverItem = {
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  coverage: "UNCOVERED" | "DRAFT" | "ASSIGNED";
  substitutionId: string | null;
  substituteName: string | null;
  /**
   * Timetabled teachers free at that time (availability only; assigning a
   * substitute still runs the eligibility gate). Null when not computed.
   */
  freeTeacherCount: number | null;
};

/** Academic-impact preview shown before a leave decision. */
export type StaffLeaveImpact = {
  leaveRequestId: string;
  staffId: string;
  status: string;
  startsOn: string;
  endsOn: string;
  dayPart: StaffLeaveDayPart;
  /** True when the leave is longer than the 31-day preview window. */
  truncated: boolean;
  previewEndsOn: string;
  totals: {
    periods: number;
    assigned: number;
    unresolved: number;
    withoutFreeTeacher: number;
  };
  days: Array<{ date: string; periods: StaffLeaveCoverItem[] }>;
};

/** Cover status of approved leave over a window, today first. */
export type StaffLeaveCoverageStatus = {
  from: string;
  to: string;
  totals: { periods: number; assigned: number; uncovered: number };
  items: Array<
    StaffLeaveCoverItem & {
      leaveRequestId: string;
      absentTeacher: { id: string; name: string; employeeId: string };
    }
  >;
};

export type StaffContractSummary = {
  id: string;
  staffId: string;
  contractNumber: string;
  position: string;
  startDate: string;
  endDate: string | null;
  baseSalary: PayrollMoneyAmount;
  allowances: PayrollMoneyAmount;
  deductions: PayrollMoneyAmount;
  status: string;
};

/**
 * Backend-owned HR/staff-coverage summary (M7 catalog gap). Every count is a
 * bounded aggregate query scoped to the current tenant and "today" in Nepal
 * local time. Never includes salary, bank, or PAN data. Sub-sections that
 * cannot be reliably derived from existing data report `available: false`
 * with a `reason` instead of a fabricated zero.
 */
export type StaffCoverageSummary = {
  asOf: string;
  staffCounts: {
    activeTeaching: number;
    activeNonTeaching: number;
  };
  attendanceToday: {
    absent: number;
    onApprovedLeave: number;
  };
  pendingLeaveApprovals: number;
  contractsExpiring: {
    windowDays: number;
    count: number;
  };
  staffWithoutActiveContract: number;
  staffWithoutActiveSalaryStructure: number;
  payrollReadiness: {
    available: boolean;
    reason?: string;
    periodMonth?: number;
    periodYear?: number;
    blockingCount?: number;
  };
  classCoverage: {
    available: boolean;
    reason?: string;
    dayOfWeek?: number;
    scheduledPeriods?: number;
    uncoveredPeriods?: number;
  };
};
