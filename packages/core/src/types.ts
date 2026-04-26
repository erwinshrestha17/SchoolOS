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

export type AttendanceAnalytics = {
  sessionsReviewed: number;
  latestSessions: Array<
    AttendanceSummary & {
      conflictStatus: string;
    }
  >;
  absenceHotlist: Array<{
    studentId: string;
    absenceCount: number;
  }>;
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
  studentTags: Array<{
    studentId: string;
    student?: {
      id: string;
      studentSystemId: string;
      firstNameEn: string;
      lastNameEn: string;
    };
  }>;
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
