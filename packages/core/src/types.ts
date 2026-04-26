import type { PermissionKey } from './permissions';

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

export type PaymentReceipt = {
  paymentId: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
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
  priority: string;
  audienceType: string;
  publishedAt: string | null;
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
  existingSession: {
    id: string;
    submittedAt: string | null;
    lockAt: string;
    conflictStatus: string;
  } | null;
  students: AttendanceRosterStudent[];
};

export type AttendanceConflict = {
  id: string;
  attendanceSessionId: string;
  status: string;
  submittedById: string | null;
  reviewedById: string | null;
  submittedAt: string;
  reviewedAt: string | null;
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
  studentTags: Array<{ studentId: string }>;
};

export type MoodLog = {
  id: string;
  studentId: string | null;
  mood: string;
  logDate: string;
  note: string | null;
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
