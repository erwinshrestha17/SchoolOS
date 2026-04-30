import type { PermissionKey } from "./permissions";

export type AuthSessionUser = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  email: string | null;
  authMethod: string;
  roles: string[];
  permissions: PermissionKey[];
};

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string | null;
  user: AuthSessionUser;
  tenant: TenantSummary;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
};

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  mode?: string;
  isActive?: boolean;
};

export type GuardianProfile = {
  id: string;
  fullName: string;
  relation: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  occupation: string | null;
  wardNumber: string | null;
  isPrimary: boolean;
  consentedAt: string | null;
};

export type EnrollmentRecord = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  rollNumber: number | null;
  admissionNumber: string | null;
  admissionDate: string;
  mediumOfInstruction: string;
  status: string;
};

export type StudentProfile = {
  id: string;
  studentSystemId: string;
  firstNameEn?: string;
  lastNameEn?: string;
  fullNameEn?: string;
  fullNameNp?: string | null;
  gender?: string;
  dateOfBirth?: string;
  motherTongue?: string | null;
  disabilityFlag?: string | null;
  nationalStudentId?: string | null;
  className?: string | null;
  sectionName?: string | null;
  class?: {
    id: string;
    name: string;
  };
  section?: string | null;
  rollNumber?: number | null;
  guardians?: GuardianProfile[];
};

export type StudentProfileEnrollment = {
  id: string;
  academicYearId: string;
  academicYear: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  rollNumber: number | null;
  status: string;
  admissionDate: string;
};

export type StudentProfileInvoiceLine = {
  id: string;
  feeHeadId: string;
  feeHeadName: string;
  description: string;
  quantity: number;
  unitAmount: number;
  vatAmount: number;
  totalAmount: number;
};

export type StudentProfileInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  issuedAt: string;
  lines: StudentProfileInvoiceLine[];
};

export type StudentProfileAttendanceRecord = {
  id: string;
  attendanceDate: string;
  status: string;
  remark: string | null;
  lateAt: string | null;
  submittedAt: string | null;
};

export type StudentProfileDetail = {
  student: StudentProfile & {
    lifecycleStatus?: string;
  };
  guardians: GuardianProfile[];
  enrollments: StudentProfileEnrollment[];
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  invoices: StudentProfileInvoice[];
  attendanceRecords: StudentProfileAttendanceRecord[];
  activityPosts: ActivityPost[];
};

export type UpdateStudentProfilePayload = {
  firstNameEn?: string;
  lastNameEn?: string;
  firstNameNp?: string | null;
  lastNameNp?: string | null;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  motherTongue?: string | null;
  ethnicity?: string | null;
  disabilityFlag?: string | null;
  confirmNoDisability?: boolean;
  nationalStudentId?: string | null;
  admissionNumber?: string | null;
  classId?: string;
  sectionId?: string | null;
  rollNumber?: number | null;
  mediumOfInstruction?: string;
};

export type UpdateStudentGuardianPayload = {
  fullName?: string;
  relation?: string;
  primaryPhone?: string;
  secondaryPhone?: string | null;
  email?: string | null;
  occupation?: string | null;
  homeAddress?: string | null;
  wardNumber?: string | null;
  isPrimary?: boolean;
};

export type AdmissionSummary = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  fullNameNp: string | null;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
  documentCount: number;
  guardians: Array<{
    id: string;
    fullName: string;
    relation: string;
    primaryPhone: string;
    isPrimary: boolean;
  }>;
  latestEnrollment: {
    id: string;
    academicYear: string;
    status: string;
  } | null;
  latestInvoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  } | null;
};

export type AdmissionCreationResult = {
  student: {
    id: string;
    studentSystemId: string;
    fullNameEn: string;
  };
  enrollment: {
    id: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    rollNumber: number | null;
  };
  guardians: Array<{
    id: string;
    fullName: string;
    relation: string;
  }>;
  documents: StudentDocument[];
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  } | null;
};

export type AttendanceSummary = {
  sessionId: string;
  attendanceDate: string;
  className: string;
  sectionName: string | null;
  submittedAt: string | null;
  lockAt: string;
  totals: {
    totalStudents: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    sickLeave: number;
    excusedLeave: number;
    unexcusedLeave: number;
  };
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueDate: string;
  totalAmount: number;
  studentId?: string;
  paidAmount?: number;
  student?: {
    id: string;
    name: string;
  };
};

export type InvoiceDetailLine = {
  id: string;
  feeHeadId: string;
  feeHeadCode: string;
  feeHeadName: string;
  description: string;
  periodLabel: string;
  quantity: number;
  unitAmount: number;
  baseAmount: number;
  discountAmount: number;
  waiverAmount: number;
  lateFeeAmount: number;
  vatAmount: number;
  totalAmount: number;
  netAmount: number;
};

export type InvoiceDetailPayment = {
  id: string;
  amount: number;
  refundedAmount: number;
  netAmount: number;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  narration: string | null;
  collector: {
    id: string;
    email: string | null;
  } | null;
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
    pdfUrl: string | null;
  } | null;
  refunds: Array<{
    id: string;
    refundNumber: string;
    amount: number;
    refundDate: string;
    reason: string;
    referenceNumber: string | null;
  }>;
  journalEntryNumber: string | null;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  fiscalYear: string | null;
  billNumber: string | null;
  status: string;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  reportCardBlocked: boolean;
  hallTicketBlocked: boolean;
  academicYear: {
    id: string;
    name: string;
  };
  billingRun: {
    id: string;
    runMonth: number;
    runYear: number;
  } | null;
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string;
    sectionName: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  totalWaivedAmount: number;
  lines: InvoiceDetailLine[];
  waivers: Array<{
    id: string;
    feeHeadId: string | null;
    feeHeadName: string | null;
    amount: number;
    reason: string;
    status: string;
    approvedAt: string | null;
    approvedBy: {
      id: string;
      email: string | null;
    } | null;
  }>;
  payments: InvoiceDetailPayment[];
  source: {
    billingRunId: string | null;
    enrollmentId: string | null;
  };
};

export type StudentFeeLedgerRow = {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT" | "WAIVER" | "REFUND";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  affectsBalance: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentId: string | null;
  receiptNumber: string | null;
  status: string | null;
};

export type StudentFeeLedger = {
  student: {
    id: string;
    studentSystemId: string;
    name: string;
    className: string;
    sectionName: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  totalWaived: number;
  totalRefunded: number;
  outstandingBalance: number;
  rows: StudentFeeLedgerRow[];
};

export type PaymentReceipt = {
  paymentId: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
};

export type PaymentRefundSummary = {
  refundId: string;
  refundNumber: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  refundDate: string;
  journalEntryNumber: string;
  remainingRefundableAmount: number;
  invoiceStatus: string;
};

export type PaymentRefundPayload = {
  amount?: number;
  reason: string;
  refundDate?: string;
  referenceNumber?: string;
  narration?: string;
};

export type CashierClosePreview = {
  openedAt: string | Date;
  closedAt: string | Date;
  collectorUserId: string | null;
  paymentMethod: string | null;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
};

export type CashierCloseSummary = {
  id: string;
  closeNumber: string;
  openedAt: string | Date;
  closedAt: string | Date;
  collectorUser?: {
    id: string;
    email: string | null;
  } | null;
  paymentMethod?: string | null;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  notes?: string | null;
  closedBy?: {
    id: string;
    email: string | null;
  } | null;
  createdAt?: string | Date;
};

export type ReconciliationRow = {
  paymentId: string;
  paymentDate: string;
  refundDate: string | null;
  receiptNumber: string | null;
  refundNumber: string | null;
  invoiceId: string;
  invoiceNumber: string;
  student: {
    id: string;
    name: string;
    className: string;
  };
  collector: {
    id: string;
    email: string | null;
  } | null;
  method: string;
  grossAmount: number;
  refundedAmount: number;
  netAmount: number;
  journalEntryNumber: string | null;
  refundJournalEntryNumbers: string[];
  statusMarkers: string[];
};

export type ReconciliationSummary = {
  openedAt: string;
  closedAt: string;
  totalRows: number;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  rows: ReconciliationRow[];
};

export type StudentLifecycleStatus =
  | "ACTIVE"
  | "TRANSFERRED"
  | "EXITED"
  | "ALUMNI"
  | "DELETED";

export type StudentLifecycleTransition = {
  id: string;
  studentId: string;
  fromStatus: StudentLifecycleStatus;
  toStatus: StudentLifecycleStatus;
  reason: string;
  changedAt: string;
  feeClearanceWaived: boolean;
  metadata?: Record<string, unknown> | null;
};

export type StudentFeeClearance = {
  studentId: string;
  studentSystemId: string;
  cleared: boolean;
  outstandingAmount: number;
  waivedAt: string | Date | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    dueDate: string | Date;
  }>;
};

export type StudentLifecycleActionResult = {
  id: string;
  studentSystemId: string;
  lifecycleStatus: StudentLifecycleStatus;
  exitedAt: string | Date | null;
  destinationSchool?: string | null;
  feeClearance?: StudentFeeClearance;
};

export type StudentTransferPayload = {
  reason: string;
  destinationSchool?: string | null;
  conductRemark?: string | null;
  exitedAt?: string;
  waiveFeeClearance?: boolean;
};

export type StudentArchivePayload = {
  reason: string;
  exitedAt?: string;
};

export type StudentDeletePayload = {
  reason: string;
  deletedAt?: string;
};

export type RevokeGeneratedStudentDocumentPayload = {
  reason: string;
};

export type UploadStudentDocumentPayload = {
  studentId: string;
  kind: string;
  title?: string | null;
  fileName: string;
  contentType: string;
  base64Content: string;
};

export type DuplicateStudentMergeCounts = {
  guardianLinks: number;
  documents: number;
  generatedDocuments: number;
  invoices: number;
  payments: number;
  feeWaivers: number;
  notificationDeliveries: number;
  developmentalMilestones: number;
  moodLogs: number;
  libraryIssues: number;
  transportEnrollments: number;
  transportLogs: number;
  conversations: number;
  conversationParticipants: number;
};

export type DuplicateStudentMergeResult = {
  sourceStudent: {
    id: string;
    studentSystemId: string;
    lifecycleStatus: StudentLifecycleStatus;
  };
  targetStudent: {
    id: string;
    studentSystemId: string;
    lifecycleStatus: StudentLifecycleStatus;
  };
  mergedAt: string;
  mergeCounts: DuplicateStudentMergeCounts;
};

export type GeneratedStudentDocumentMeta = {
  id: string;
  studentId: string;
  kind: string;
  title?: string | null;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  pdfUrl: string;
  generatedById?: string | null;
  generatedAt?: string | null;
  checksumSha256: string | null;
  storageObjectKey: string | null;
  signedAt: string | null;
  version: number;
  retentionUntil: string | null;
  revokedAt: string | null;
};

export type GuardianIdentityVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "REVOKED";

export type GuardianIdentityVerification = {
  id: string;
  guardianId: string;
  status: GuardianIdentityVerificationStatus;
  documentType: string;
  documentNumber: string | null;
  evidenceDocumentId: string | null;
  notes: string | null;
  submittedById: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IemisValidationIssue = {
  studentId: string;
  studentSystemId: string;
  field: string;
  message: string;
};

export type IemisExportRow = {
  studentSystemId: string;
  nationalStudentId: string;
  firstNameEn: string;
  lastNameEn: string;
  firstNameNp: string;
  lastNameNp: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  motherTongue: string;
  ethnicity: string;
  disabilityFlag: string;
  admissionDate: string;
  admissionNumber: string;
  lifecycleStatus: StudentLifecycleStatus;
  academicYear: string;
  className: string;
  sectionName: string;
  rollNumber: string | number;
  primaryGuardianName: string;
  primaryGuardianRelation: string;
  primaryGuardianPhone: string;
  primaryGuardianEmail: string;
  wardNumber: string;
  guardianCount: number;
};

export type IemisExportResult = {
  formatVersion: "SCHOLOS-IEMIS-1.0";
  exportedAt: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  issues: IemisValidationIssue[];
  headers: Array<keyof IemisExportRow>;
  rows: IemisExportRow[];
  csv: string;
};

export type JournalEntryView = {
  id: string;
  entryNumber: string;
  entryDate: string;
  narration: string;
  sourceType: string;
  totalDebit?: number;
  totalCredit?: number;
  lines?: Array<{
    id: string;
    side: string;
    amount: number;
    description: string | null;
    chartAccount: {
      code: string;
      name: string;
    };
  }>;
};

export type NoticeSummary = {
  id: string;
  title: string;
  body?: string;
  priority: string;
  audienceType: string;
  classId?: string | null;
  sectionId?: string | null;
  scheduledFor?: string | null;
  publishedAt: string | null;
  createdAt?: string;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  audienceType: string;
  classId: string | null;
  sectionId: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  createdAt: string;
};

export type AcademicYearSummary = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

export type ClassSummary = {
  id: string;
  name: string;
  code?: string | null;
  level?: number;
  studentCount?: number;
  sectionCount?: number;
  subjectCount?: number;
};

export type SectionSummary = {
  id: string;
  name: string;
  classId?: string;
  class?: {
    id: string;
    name: string;
  };
  capacity: number | null;
  studentCount?: number;
};

export type StaffSummary = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  roles: string[];
  joiningDate: string;
  contractType: string;
};

export type RoleSummary = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type StudentDocument = {
  id: string;
  studentId: string;
  kind: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: string;
  objectKey: string;
  publicUrl: string | null;
  uploadedAt: string;
};

export type GeneratedStudentDocument = {
  id: string;
  studentId: string;
  kind: string;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  pdfUrl: string;
  generatedById: string | null;
  generatedAt: string;
};

export type AdmissionDuplicateWarning = {
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  dateOfBirth: string;
  className: string;
  sectionName: string | null;
  rollNumber: number | null;
};

export type AdmissionDuplicateCheckResult = {
  hasWarnings: boolean;
  matches: AdmissionDuplicateWarning[];
};

export type BulkAdmissionImportResult = {
  totalRows: number;
  created: number;
  validated: number;
  failed: number;
  results: Array<{
    rowNumber: number;
    status: "created" | "validated" | "failed";
    studentId?: string;
    studentSystemId?: string;
    errors?: string[];
  }>;
  errorReportCsv: string;
};

export type SiblingGroup = {
  id: string;
  name: string;
  discountEligible: boolean;
  members: Array<{
    id: string;
    studentId: string;
    relationLabel: string | null;
  }>;
};

export type AttendanceRosterStudent = {
  id: string;
  studentSystemId: string;
  fullNameEn: string;
  rollNumber: number | null;
  hasMedicalAlert: boolean;
  status: string;
  remark: string | null;
};

export type AttendanceRoster = {
  academicYear: AcademicYearSummary;
  class: ClassSummary;
  section: SectionSummary | null;
  attendanceDate: string;
  calendarDay: AttendanceCalendarDayView;
  existingSession: {
    id: string;
    submittedAt: string | null;
    lockAt: string;
    conflictStatus: string;
  } | null;
  students: AttendanceRosterStudent[];
};

export type AttendanceAnalytics = {
  sessionsReviewed: number;
  todaySummary: {
    date: string;
    sessionCount: number;
    totals: AttendanceSummary["totals"];
  };
  monthlyAttendance: {
    month: number;
    year: number;
    attendancePercent: number;
  };
  annualAttendance: {
    year: number;
    attendancePercent: number;
  };
  latestSessions: Array<
    AttendanceSummary & {
      conflictStatus: string;
      calendarDay?: AttendanceCalendarDayView;
    }
  >;
  classHeatmap: Array<{
    attendanceDate: string;
    className: string;
    sectionName: string | null;
    attendancePercent: number;
  }>;
  absenceHotlist: Array<{
    studentId: string;
    absenceCount: number;
  }>;
  consecutiveAbsences?: Array<{
    studentId: string;
    consecutiveAbsences: number;
  }>;
  below80Warnings?: Array<{
    studentId: string;
    studentSystemId: string;
    fullNameEn: string;
    attendancePercent: number;
  }>;
};

export type AttendanceOperationalSummary = {
  classDaily: {
    attendanceDate: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    submittedAt: string | null;
    totals: AttendanceSummary["totals"];
  };
  studentMonthly: {
    studentId: string;
    month: number;
    year: number;
    attendancePercent: number;
    consecutiveAbsences: number;
  } | null;
};

export type AttendanceConflict = {
  id: string;
  attendanceSessionId: string;
  status: string;
  decision?: string | null;
  submittedById: string | null;
  reviewedById: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  resolutionNote?: string | null;
  attendanceDate?: string;
  className?: string;
  sectionName?: string | null;
};

export type AttendanceSyncResult = {
  id: string;
  clientSubmissionId: string;
  attendanceSessionId: string | null;
  conflictId: string | null;
  syncStatus: string;
  attendanceDate: string;
  deviceId: string | null;
  deviceLabel: string | null;
  deviceTimestamp: string | null;
  sessionFingerprint: string | null;
  syncAttemptCount: number;
  serverReceivedAt: string;
  replayed: boolean;
  rejectionReason: string | null;
  createdAt: string;
};

export type AttendanceSyncSubmission = AttendanceSyncResult;

export type AttendanceConflictReviewResult = {
  id: string;
  attendanceSessionId: string;
  status: string;
  decision: string;
  resolutionNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  affectedSyncSubmissionCount: number;
};

export type StaffLeaveRequestSummary = {
  id: string;
  staffId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number;
  reason: string;
  status: string;
  reviewedAt: string | null;
};

export type AttendanceCalendarDayView = {
  calendarDate: string;
  isWorkingDay: boolean;
  label: string | null;
  holidayType: string | null;
  source: "explicit" | "weekday_fallback";
};

export type SchoolCalendarDaySummary = {
  id: string;
  calendarDate: string;
  isWorkingDay: boolean;
  label: string | null;
  holidayType: string | null;
};

export type AttendanceEscalationWarning = {
  type: "consecutive_absence" | "below_threshold";
  sourceType: string;
  sourceId: string;
  studentId: string;
  studentSystemId: string;
  fullNameEn: string;
  className: string;
  sectionName: string | null;
  warningDate: string;
  consecutiveAbsences?: number;
  attendancePercent?: number;
  deliveryCount: number;
};

export type StaffAttendanceMonthlySummary = {
  month: number;
  year: number;
  items: Array<{
    staffId: string;
    employeeId: string;
    fullName: string;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    leaveDays: number;
    approvedLeaveDays: number;
    unresolvedOverlapAnomalies: number;
  }>;
};

export type FeeHeadSummary = {
  id: string;
  code: string;
  name: string;
  frequency: string;
  defaultAmount: number;
  vatApplicable: boolean;
};

export type FeePlanSummary = {
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  classId: string | null;
  isActive: boolean;
};

export type FeeBillingRun = {
  id: string;
  academicYearId: string;
  feePlanId: string | null;
  runMonth: number;
  runYear: number;
  status: string;
  generatedAt: string;
  invoiceCount?: number;
};

export type FeeDueScheduleSummary = {
  id: string;
  academicYearId: string;
  feePlanId: string | null;
  name: string;
  scheduleType: string;
  dueDate: string;
  reminderDays: number[];
  stopOnPaid: boolean;
  lastProcessedAt: string | null;
};

export type FeeCollectionReport = {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  totalWaived: number;
  collectionTrend: Array<{ month: string; amount: number }>;
  classWiseBreakdown: Array<{ className: string; amount: number }>;
  feeHeadWiseBreakdown: Array<{ feeHeadName: string; amount: number }>;
};

export type DefaulterSummary = {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string | null;
  dueDate: string;
  outstanding: number;
  daysOverdue: number;
  agingBucket: string;
  reportCardBlocked?: boolean;
  hallTicketBlocked?: boolean;
};

export type DefaulterReminderResult = {
  requested: number;
  reminded: number;
  channels: string[];
  deliveryResults: Array<{
    invoiceId: string;
    deliveryCount: number;
  }>;
};

export type DiscountRule = {
  id: string;
  name: string;
  type: string;
  percentOff: number | null;
  amountOff: number | null;
  isActive: boolean;
};

export type WaiverRecord = {
  id: string;
  studentId: string;
  invoiceId: string | null;
  feeHeadId: string | null;
  amount: number;
  status: string;
  reason: string;
  approvedAt: string | null;
};

export type ReceiptView = {
  id: string;
  receiptNumber: string;
  pdfUrl: string | null;
  issuedAt: string;
  paymentId?: string;
  amount?: number;
  refundedAmount?: number;
  method?: string;
  invoiceNumber?: string;
  student?: {
    id: string;
    name: string;
  };
  payment?: {
    id: string;
    amount: number;
    method: string;
    paidAt: string;
    invoiceId: string;
    studentId: string;
  };
};

export type ActivityAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: string;
  objectKey: string;
  publicUrl: string | null;
  sortOrder: number;
};

export type ActivityPost = {
  id: string;
  title: string;
  body?: string;
  caption?: string;
  category: string;
  audienceType: string;
  classId: string | null;
  sectionId: string | null;
  publishedAt: string | null;
  attachments: ActivityAttachment[];
  studentTags: Array<{
    studentId: string;
    student?: {
      id: string;
      studentSystemId: string;
      firstNameEn: string;
      lastNameEn: string;
    };
  }>;
  reactions?: ActivityReaction[];
};

export type ActivityReaction = {
  id: string;
  activityPostId: string;
  guardianId: string | null;
  studentId: string | null;
  reaction: "HEART" | "CLAP" | "STAR";
  createdAt: string;
};

export type ActivityReactionAnalytics = {
  byReaction: Array<{ reaction: string; count: number }>;
  topPosts: Array<{
    postId: string;
    title: string;
    category: string;
    reactionCount: number;
  }>;
};

export type DevelopmentalMilestone = {
  id: string;
  classId: string;
  sectionId: string | null;
  studentId: string;
  domain: string;
  milestone: string;
  status: "EMERGING" | "PROGRESSING" | "ACHIEVED" | "NEEDS_SUPPORT";
  observationNote: string | null;
  photoObjectKey: string | null;
  photoUrl: string | null;
  observedAt: string;
  createdAt: string;
};

export type MoodLog = {
  id: string;
  classId?: string;
  sectionId?: string | null;
  studentId: string | null;
  mood: string;
  logDate: string;
  note: string | null;
  student?: {
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
  } | null;
};

export type NotificationDelivery = {
  id: string;
  channel: string;
  status: string;
  sourceType: string;
  sourceId: string;
  audienceType: string;
  destination: string | null;
  title: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
};

export type ConsentRecord = {
  id: string;
  guardianId: string;
  consentType: string;
  granted: boolean;
  version: string;
  capturedAt: string;
  revokedAt: string | null;
};

export type GuardianConsentStatus = {
  guardianId: string;
  consentType: string;
  granted: boolean;
  latestConsentId: string | null;
  version: string | null;
  capturedAt: string | null;
  revokedAt: string | null;
};

export type SubjectSummary = {
  id: string;
  classId: string;
  code: string;
  name: string;
  type: string;
  hasPractical: boolean;
  theoryMarks: number | null;
  practicalMarks: number | null;
  passMarks: number | null;
  class?: ClassSummary;
};

export type TeacherAssignmentSummary = {
  id: string;
  academicYearId: string;
  subjectId: string;
  staffId: string;
  classId: string;
  sectionId: string | null;
  subject?: SubjectSummary;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
};

export type ExamTermSummary = {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  weightPercent: number;
  isLocked: boolean;
  components?: AssessmentComponentSummary[];
};

export type ExamTimetableSlotSummary = {
  id: string;
  academicYearId: string;
  examTermId: string;
  subjectId: string;
  classId: string;
  sectionId: string | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  publishedAt: string | null;
};

export type MarkLockRequestSummary = {
  id: string;
  examTermId: string;
  status: string;
  reason: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AssessmentComponentSummary = {
  id: string;
  examTermId: string;
  subjectId: string;
  name: string;
  type: string;
  maxMarks: number;
  weightPercent: number;
  passMarks: number | null;
  subject?: SubjectSummary;
};

export type MarkEntrySummary = {
  id: string;
  examTermId: string;
  assessmentComponentId: string;
  subjectId: string;
  studentId: string;
  marksObtained: number;
  remarks: string | null;
  isLocked: boolean;
  student?: StudentProfile;
  subject?: SubjectSummary;
  assessmentComponent?: AssessmentComponentSummary;
};

export type CasRecordSummary = {
  id: string;
  academicYearId: string;
  subjectId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  category: string;
  score: number;
  maxScore: number;
  observedOn: string;
  note: string | null;
};

export type ReportCardSummary = {
  id: string;
  academicYearId: string;
  examTermId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
  status: string;
  lockedAt: string | null;
  student?: StudentProfile;
};

export type PromotionReadiness = {
  reportCardId: string;
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string | null;
  examTerm: string;
  percentage: number;
  grade: string;
  status: string;
  locked: boolean;
};

export type PromotionResult = {
  promotion: {
    id: string;
    studentId: string;
    fromClassId: string;
    fromSectionId: string | null;
    toClassId: string | null;
    toSectionId: string | null;
    status: string;
    remarks: string | null;
  };
  targetEnrollment: EnrollmentRecord;
};

export type TimetableSlotSummary = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  staffId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  room: string | null;
  class?: ClassSummary;
  section?: SectionSummary | null;
  subject?: SubjectSummary;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
};

export type TeacherWorkloadSummary = {
  staffId: string;
  employeeId: string;
  staffName: string;
  slotCount: number;
  homeworkCount: number;
  teachingMinutes: number;
  weeklyHours: number;
  slots: TimetableSlotSummary[];
};

export type HomeworkAssignmentSummary = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number | null;
  submissions?: HomeworkSubmissionSummary[];
};

export type HomeworkSubmissionSummary = {
  id: string;
  homeworkId: string;
  studentId: string;
  status: string;
  submittedAt: string | null;
  score: number | null;
  feedback: string | null;
  student?: StudentProfile;
};

export type StaffContractSummary = {
  id: string;
  staffId: string;
  contractNumber: string;
  position: string;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  allowances: number;
  deductions: number;
  status: string;
};

export type PayrollRunSummary = {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  lineCount?: number;
  journalEntryId: string | null;
  lines?: PayrollLineSummary[];
};

export type PayrollLineSummary = {
  id: string;
  staffId: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  attendanceDays: number;
  workingDays: number;
  status: string;
};

export type PayslipSummary = {
  id: string;
  payrollRunId: string;
  payrollLineId: string;
  staffId: string;
  payslipNumber: string;
  status: string;
  grossSalary: number;
  deductionAmount: number;
  netSalary: number;
  issuedAt: string | null;
};

export type AccountingPeriodSummary = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  closedAt: string | null;
};

export type AccountingReport = {
  trialBalance: Array<{
    accountId: string;
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: {
    debit: number;
    credit: number;
  };
  incomeStatement: {
    income: number;
    expenses: number;
    netIncome: number;
  };
  balanceSheet?: {
    assets: number;
    liabilities: number;
    equity: number;
  };
  cashFlow?: {
    netCashMovement: number;
  };
  balanced: boolean;
};

export type ConversationSummary = {
  id: string;
  type: string;
  title: string | null;
  classId: string | null;
  sectionId: string | null;
  studentId: string | null;
  guardianId: string | null;
  updatedAt: string;
  messages?: MessageSummary[];
};

export type MessageSummary = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  body: string;
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
};

export type MessageReadReceiptSummary = {
  id: string;
  messageId: string;
  readerUserId: string | null;
  guardianId: string | null;
  readAt: string;
};

export type LibraryBookSummary = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  subjectCategory: string | null;
  classLevel: string | null;
  copyCount?: number;
};

export type LibraryCopySummary = {
  id: string;
  bookId: string;
  barcode: string;
  qrCode: string | null;
  status: string;
  shelfLocation: string | null;
  replacementCost: number | null;
};

export type LibraryIssueSummary = {
  id: string;
  copyId: string;
  borrowerStudentId: string | null;
  borrowerStaffId: string | null;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  fineAmount: number;
  invoiceId: string | null;
};

export type TransportRouteSummary = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  stops?: TransportStopSummary[];
};

export type TransportStopSummary = {
  id: string;
  routeId: string;
  name: string;
  sequence: number;
  estimatedPickup: string | null;
  estimatedDrop: string | null;
};

export type TransportVehicleSummary = {
  id: string;
  registrationNumber: string;
  capacity: number;
  status: string;
  fitnessCertificateExp: string | null;
};

export type TransportEnrollmentSummary = {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string;
  feeAmount: number;
  status: string;
  feeAssignmentId: string | null;
};

export type TransportLogSummary = {
  id: string;
  routeId: string;
  stopId: string | null;
  vehicleId: string | null;
  enrollmentId: string | null;
  studentId: string | null;
  status: string;
  occurredAt: string;
};
