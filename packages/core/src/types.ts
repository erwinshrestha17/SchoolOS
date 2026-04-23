export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: {
    id: string;
    email: string | null;
    roles: Array<{ id: string; name: string }>;
  };
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
  fullNameEn: string;
  fullNameNp: string | null;
  gender: string;
  dateOfBirth: string;
  motherTongue: string | null;
  disabilityFlag: string | null;
  nationalStudentId: string | null;
  className: string | null;
  sectionName: string | null;
  guardians: GuardianProfile[];
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
  studentId: string;
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
  totalDebit: number;
  totalCredit: number;
};

export type NoticeSummary = {
  id: string;
  title: string;
  priority: string;
  audienceType: string;
  publishedAt: string | null;
};
