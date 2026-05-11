-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('PASSWORD', 'OTP', 'BOTH');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'RESET', 'VERIFY');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'TEMPORARY', 'PART_TIME');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'TRANSFERRED', 'EXITED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'ON_LEAVE', 'HOLIDAY', 'SICK_LEAVE', 'EXCUSED_LEAVE', 'UNEXCUSED_LEAVE');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'TERM', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'CHEQUE', 'TRANSFER', 'MOBILE');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'INVOICE', 'FEE_PAYMENT', 'PAYMENT_REFUND', 'PAYROLL', 'PAYROLL_RUN', 'PAYROLL_DISBURSEMENT', 'CLOSING', 'ADJUSTMENT', 'REVERSAL', 'CORRECTION', 'OPENING_BALANCE', 'EXPENSE_VOUCHER', 'PAYMENT_VOUCHER', 'RECEIPT_VOUCHER', 'CONTRA_VOUCHER', 'CLOSING_ENTRY');

-- CreateEnum
CREATE TYPE "JournalLineSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ChartAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountingReportMappingType" AS ENUM ('CASH', 'BANK', 'VAT_OUTPUT', 'VAT_INPUT', 'TDS_PAYABLE', 'PF_EMPLOYEE_PAYABLE', 'PF_EMPLOYER_PAYABLE', 'PF_PAYABLE', 'RETAINED_EARNINGS');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffEmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalaryStructureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "NoticePriority" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('ALL', 'CLASS', 'SECTION', 'ROLE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GENERAL', 'EXAM', 'MEETING', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'R2');

-- CreateEnum
CREATE TYPE "StudentDocumentKind" AS ENUM ('BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE', 'CITIZENSHIP_DOC', 'PREVIOUS_REPORT_CARD', 'MEDICAL_RECORD', 'PHOTO', 'ID_CARD', 'ENROLLMENT_CONFIRMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceConflictStatus" AS ENUM ('NONE', 'FLAGGED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "AttendanceConflictDecision" AS ENUM ('REVIEWED_WITHOUT_CHANGE', 'REVIEWED_AND_OVERRIDDEN', 'REJECTED_RESUBMISSION');

-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('DRAFT', 'GENERATED', 'VOID');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('SIBLING', 'SCHOLARSHIP', 'STAFF_CHILD', 'MANUAL');

-- CreateEnum
CREATE TYPE "WaiverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('LEARNING', 'OUTDOOR_PLAY', 'ART_AND_CRAFT', 'CELEBRATION', 'SPORTS', 'GENERAL');

-- CreateEnum
CREATE TYPE "MoodValue" AS ENUM ('CALM', 'ENGAGED', 'EXCITED', 'UNSETTLED', 'TIRED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY', 'DATA_PROCESSING', 'MEDICAL', 'PHOTO_USAGE', 'MESSAGING');

-- CreateEnum
CREATE TYPE "AttendanceSyncStatus" AS ENUM ('SYNCED', 'CONFLICTED', 'REJECTED', 'DUPLICATE', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "AttendanceSyncRejectionReason" AS ENUM ('LOCKED_SESSION', 'VALIDATION_ERROR', 'ROSTER_MISMATCH', 'REFERENCE_NOT_FOUND', 'UNKNOWN', 'ALREADY_MARKED', 'HOLIDAY', 'CROSS_TENANT', 'STALE_DRAFT', 'UNASSIGNED_TEACHER');

-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityReactionType" AS ENUM ('HEART', 'CLAP', 'STAR');

-- CreateEnum
CREATE TYPE "DevelopmentalMilestoneStatus" AS ENUM ('EMERGING', 'PROGRESSING', 'ACHIEVED', 'NEEDS_SUPPORT');

-- CreateEnum
CREATE TYPE "ExamTermStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('THEORY', 'PRACTICAL', 'CAS', 'PROJECT', 'INTERNAL', 'TERMINAL');

-- CreateEnum
CREATE TYPE "GradeLockStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "HomeworkAssignmentStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'LATE', 'REVIEWED', 'NEEDS_CORRECTION', 'EXCUSED');

-- CreateEnum
CREATE TYPE "TimetableVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeacherAvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TimetableSubstitutionStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'REVIEWED', 'APPROVED', 'POSTED', 'PAID', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "PayrollLineStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StudentLifecycleStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'EXITED', 'ALUMNI', 'ARCHIVED', 'MERGED', 'DELETED');

-- CreateEnum
CREATE TYPE "StudentDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'REPLACED', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "GuardianIdentityVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'CLASS', 'SECTION');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "ParentTeacherThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ParentTeacherSenderRole" AS ENUM ('PARENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ParentTeacherMessagePriority" AS ENUM ('NORMAL', 'IMPORTANT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ChatAvailabilityAppliesToRole" AS ENUM ('TEACHER', 'PARENT', 'BOTH');

-- CreateEnum
CREATE TYPE "ChatEscalationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ChatAbuseReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN');

-- CreateEnum
CREATE TYPE "LibraryCopyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED', 'RESERVED');

-- CreateEnum
CREATE TYPE "LibraryIssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST');

-- CreateEnum
CREATE TYPE "TransportVehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "TransportEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "TransportBoardingStatus" AS ENUM ('BOARDED', 'DROPPED', 'MISSED');

-- CreateEnum
CREATE TYPE "TransportTripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportTripDirection" AS ENUM ('PICKUP', 'DROP');

-- CreateEnum
CREATE TYPE "TransportStudentTripStatus" AS ENUM ('PENDING', 'BOARDED', 'DROPPED', 'ABSENT');

-- CreateEnum
CREATE TYPE "CanteenMenuItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CanteenMealPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CanteenEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'ENDED');

-- CreateEnum
CREATE TYPE "CanteenMealServingStatus" AS ENUM ('SERVED', 'NOT_TAKEN', 'ABSENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CanteenWalletTransactionType" AS ENUM ('TOP_UP', 'DEDUCTION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CanteenWalletTransactionSource" AS ENUM ('MANUAL', 'POS_SALE', 'MEAL_PURCHASE', 'FEE_INTEGRATION', 'ACCOUNTING_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CanteenPosSaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CanteenPaymentMethod" AS ENUM ('CASH', 'WALLET', 'STAFF_CREDIT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MarkEntryStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'MISSING', 'WITHHELD', 'SUBMITTED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'SINGLE',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "panNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "authMethod" "AuthMethod" NOT NULL DEFAULT 'PASSWORD',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "module" TEXT,
    "entityId" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "softDeletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "classTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hasPractical" BOOLEAN NOT NULL DEFAULT false,
    "theoryMarks" DOUBLE PRECISION,
    "practicalMarks" DOUBLE PRECISION,
    "passMarks" DOUBLE PRECISION,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "studentSystemId" TEXT NOT NULL,
    "firstNameEn" TEXT NOT NULL,
    "lastNameEn" TEXT NOT NULL,
    "firstNameNp" TEXT,
    "lastNameNp" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Nepali',
    "religion" TEXT,
    "ethnicity" TEXT,
    "motherTongue" TEXT,
    "disabilityFlag" TEXT,
    "nationalStudentId" TEXT,
    "birthCertNumber" TEXT,
    "citizenshipNo" TEXT,
    "photoUrl" TEXT,
    "photoFileId" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "admissionNumber" TEXT,
    "previousSchool" TEXT,
    "transferCertUrl" TEXT,
    "lifecycleStatus" "StudentLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "exitReason" TEXT,
    "exitedAt" TIMESTAMP(3),
    "destinationSchool" TEXT,
    "conductRemark" TEXT,
    "feeClearanceWaivedAt" TIMESTAMP(3),
    "feeClearanceWaivedById" TEXT,
    "mediumOfInstruct" TEXT NOT NULL DEFAULT 'English',
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "section" TEXT,
    "rollNumber" INTEGER,
    "medicalConditions" TEXT,
    "severeAllergies" TEXT,
    "medications" TEXT,
    "specialNeeds" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "doctorName" TEXT,
    "doctorPhone" TEXT,
    "qrCode" TEXT,
    "studentIdentityCode" TEXT,
    "privacyConsentAt" TIMESTAMP(3),
    "dataProcessingConsentedAt" TIMESTAMP(3),
    "medicalConsentAt" TIMESTAMP(3),
    "photoUsageConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "primaryPhone" TEXT NOT NULL,
    "secondaryPhone" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "homeAddress" TEXT,
    "wardNumber" TEXT,
    "receivesAlerts" BOOLEAN NOT NULL DEFAULT false,
    "privacyConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianIdentityVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "status" "GuardianIdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "evidenceDocumentId" TEXT,
    "notes" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianIdentityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "appLoginLinked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "rollNumber" INTEGER,
    "admissionNumber" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "mediumOfInstruction" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "staffCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstNameNp" TEXT,
    "lastNameNp" TEXT,
    "photoUrl" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL,
    "teacherRegistryId" TEXT,
    "citizenshipNo" TEXT,
    "panNumber" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "employmentType" "StaffEmploymentType",
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractStatus" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "qualifications" TEXT,
    "experience" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "probationEndDate" TIMESTAMP(3),
    "privacyConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffQualification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT,
    "year" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffExperienceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffExperienceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockAt" TIMESTAMP(3) NOT NULL,
    "conflictStatus" "AttendanceConflictStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "remark" TEXT,
    "lateAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "attendanceSessionId" TEXT,
    "studentId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "leaveType" TEXT,
    "note" TEXT,
    "checkInAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCalendarDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "calendarDate" TIMESTAMP(3) NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "holidayType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "opening" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "carried" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(8,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeHead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "FeeFrequency" NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlanItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "feeHeadId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feePlanId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentFeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "billingRunId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "fiscalYear" TEXT,
    "billNumber" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "reportCardBlocked" BOOLEAN NOT NULL DEFAULT false,
    "hallTicketBlocked" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "feeHeadId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "collectedById" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
    "referenceNumber" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "isAdvance" BOOLEAN NOT NULL DEFAULT false,
    "recognizedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalReason" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "narration" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierClose" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "closeNumber" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "collectorUserId" TEXT,
    "paymentMethod" "PaymentMethod",
    "grossCollected" DECIMAL(12,2) NOT NULL,
    "totalRefunded" DECIMAL(12,2) NOT NULL,
    "netCollected" DECIMAL(12,2) NOT NULL,
    "expectedCashAmount" DECIMAL(12,2),
    "actualCashAmount" DECIMAL(12,2),
    "varianceAmount" DECIMAL(12,2),
    "varianceReason" TEXT,
    "denominationBreakdown" JSONB,
    "methodBreakdown" JSONB,
    "paymentCount" INTEGER NOT NULL,
    "refundCount" INTEGER NOT NULL,
    "firstReceiptNumber" TEXT,
    "lastReceiptNumber" TEXT,
    "notes" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "fiscalYear" TEXT,
    "schoolPan" TEXT,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptReprintHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "reprintedById" TEXT,
    "reprintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ReceiptReprintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeDueSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "feePlanId" TEXT,
    "name" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "runMonth" INTEGER,
    "runYear" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reminderDays" INTEGER[],
    "stopOnPaid" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeDueSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYearId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChartAccountType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYearId" TEXT,
    "fiscalPeriodId" TEXT,
    "entryNumber" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceModule" TEXT,
    "sourceType" "JournalSourceType" NOT NULL,
    "sourceId" TEXT,
    "postingType" TEXT,
    "reversalOfId" TEXT,
    "correctionOfId" TEXT,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "submissionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalNote" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "side" "JournalLineSide" NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "lineNumber" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closeReason" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockReason" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "unlockReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closeReason" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "NoticePriority" NOT NULL DEFAULT 'NORMAL',
    "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL',
    "attachmentUrl" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "EventType" NOT NULL DEFAULT 'GENERAL',
    "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileId" TEXT,
    "kind" "StudentDocumentKind" NOT NULL,
    "status" "StudentDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "objectKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "signedUrl" TEXT,
    "notes" TEXT,
    "expiryDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMergeHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceStudentId" TEXT NOT NULL,
    "targetStudentId" TEXT NOT NULL,
    "mergedById" TEXT,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "StudentMergeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "identityCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocumentHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT,
    "action" TEXT NOT NULL,
    "documentTitle" TEXT,
    "documentKind" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocumentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedStudentDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "generatedById" TEXT,
    "storageObjectKey" TEXT,
    "checksumSha256" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureMetadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "retentionUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "GeneratedStudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLifecycleTransition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromStatus" "StudentLifecycleStatus",
    "toStatus" "StudentLifecycleStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeClearanceWaived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "StudentLifecycleTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiblingGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiblingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiblingGroupMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siblingGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiblingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceConflict" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceSessionId" TEXT NOT NULL,
    "submittedById" TEXT,
    "status" "AttendanceConflictStatus" NOT NULL DEFAULT 'FLAGGED',
    "decision" "AttendanceConflictDecision",
    "previousPayload" JSONB NOT NULL,
    "incomingPayload" JSONB NOT NULL,
    "resolutionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSyncSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientSubmissionId" TEXT NOT NULL,
    "attendanceSessionId" TEXT,
    "conflictId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "deviceLabel" TEXT,
    "deviceTimestamp" TIMESTAMP(3),
    "sessionFingerprint" TEXT,
    "syncStatus" "AttendanceSyncStatus" NOT NULL DEFAULT 'ACCEPTED',
    "syncAttemptCount" INTEGER NOT NULL DEFAULT 1,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReason" "AttendanceSyncRejectionReason",
    "submittedById" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSyncSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeBillingRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "feePlanId" TEXT,
    "runMonth" INTEGER NOT NULL,
    "runYear" INTEGER NOT NULL,
    "status" "BillingRunStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    "notes" TEXT,

    CONSTRAINT "FeeBillingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "feeHeadId" TEXT,
    "classId" TEXT,
    "feePlanId" TEXT,
    "percentOff" DECIMAL(5,2),
    "amountOff" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeWaiver" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeHeadId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "WaiverStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL DEFAULT 'GENERAL',
    "audienceType" "AudienceType" NOT NULL DEFAULT 'CLASS',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activityPostId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "objectKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "fileAssetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPostStudent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activityPostId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityPostStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityReaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activityPostId" TEXT NOT NULL,
    "guardianId" TEXT,
    "studentId" TEXT,
    "reaction" "ActivityReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentalMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "studentId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "status" "DevelopmentalMilestoneStatus" NOT NULL,
    "observationNote" TEXT,
    "photoObjectKey" TEXT,
    "photoUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "studentId" TEXT,
    "mood" "MoodValue" NOT NULL,
    "note" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL',
    "recipientUserId" TEXT,
    "guardianId" TEXT,
    "studentId" TEXT,
    "noticeId" TEXT,
    "eventId" TEXT,
    "activityPostId" TEXT,
    "destination" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationReadReceipt" (
    "tenantId" TEXT NOT NULL,
    "notificationDeliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReadReceipt_pkey" PRIMARY KEY ("tenantId","notificationDeliveryId","userId")
);

-- CreateTable
CREATE TABLE "GuardianConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectTeacherAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTerm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "status" "ExamTermStatus" NOT NULL DEFAULT 'ACTIVE',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'TERMINAL',
    "maxMarks" DECIMAL(8,2) NOT NULL,
    "weightPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "passMarks" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "assessmentComponentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enteredById" TEXT,
    "marksObtained" DECIMAL(8,2) NOT NULL,
    "status" "MarkEntryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "remarks" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "category" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "maxScore" DECIMAL(8,2) NOT NULL,
    "observedOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "totalMarks" DECIMAL(10,2) NOT NULL,
    "maxMarks" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "gpa" DECIMAL(3,2) NOT NULL,
    "remarks" TEXT,
    "status" "GradeLockStatus" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "unpublishedAt" TIMESTAMP(3),
    "publishStatus" TEXT DEFAULT 'UNPUBLISHED',

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTimetableSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkLockRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MarkLockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "fromSectionId" TEXT,
    "toClassId" TEXT,
    "toSectionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT,
    "sectionId" TEXT,
    "versionName" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "TimetableVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versionId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "periodId" TEXT,
    "roomId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "type" "TeacherAvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherWorkloadLimit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "staffId" TEXT NOT NULL,
    "maxPeriodsPerDay" INTEGER,
    "maxPeriodsPerWeek" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherWorkloadLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSubstitution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timetableSlotId" TEXT NOT NULL,
    "absentTeacherId" TEXT NOT NULL,
    "substituteTeacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TimetableSubstitutionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkReminderBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 0,
    "deliveryCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "dueSoonCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkReminderBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "assignedByStaffId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "HomeworkAssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "attachmentMetadata" JSONB,
    "maxScore" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "submissionText" TEXT,
    "submissionContent" TEXT,
    "score" DECIMAL(8,2),
    "feedback" TEXT,
    "teacherRemarks" TEXT,
    "correctionRemarks" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "attachmentMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT,
    "assignmentId" TEXT,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tdsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK',
    "bankAccount" TEXT,
    "bankName" TEXT,
    "status" "SalaryStructureStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentType" "SalaryComponentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYearId" TEXT,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "generatedById" TEXT,
    "approvedById" TEXT,
    "postedById" TEXT,
    "paidById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "disbursementJournalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "contractId" TEXT,
    "salaryStructureId" TEXT,
    "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "leaveDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "paidDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "unpaidDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "attendanceDays" INTEGER NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PayrollPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "PayrollLineStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollLineId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "payslipNumber" TEXT NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "deductionAmount" DECIMAL(12,2) NOT NULL,
    "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PayrollPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closeJournalEntryId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
    "title" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "studentId" TEXT,
    "guardianId" TEXT,
    "academicYearId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "guardianId" TEXT,
    "staffId" TEXT,
    "studentId" TEXT,
    "role" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderStaffId" TEXT,
    "senderGuardianId" TEXT,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "readerUserId" TEXT,
    "guardianId" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentTeacherThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "classTeacherId" TEXT NOT NULL,
    "status" "ParentTeacherThreadStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closeReason" TEXT,

    CONSTRAINT "ParentTeacherThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentTeacherMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" "ParentTeacherSenderRole" NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "ParentTeacherMessagePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentTeacherMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAvailabilityRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "appliesToRole" "ChatAvailabilityAppliesToRole" NOT NULL DEFAULT 'BOTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatEscalation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "escalatedByUserId" TEXT NOT NULL,
    "escalatedToUserId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ChatEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "ChatEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAbuseReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ChatAbuseReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "publisher" TEXT,
    "publishedYear" INTEGER,
    "subjectCategory" TEXT,
    "classLevel" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCopy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "qrCode" TEXT,
    "status" "LibraryCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "shelfLocation" TEXT,
    "replacementCost" DECIMAL(12,2),
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "borrowerStudentId" TEXT,
    "borrowerStaffId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnCondition" TEXT,
    "status" "LibraryIssueStatus" NOT NULL DEFAULT 'ISSUED',
    "fineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportStop" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimatedPickup" TEXT,
    "estimatedDrop" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TransportVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "fitnessCertificateExp" TIMESTAMP(3),
    "model" TEXT,
    "documentExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDriverAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "routeId" TEXT,
    "staffId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "licenseExpires" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportDriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "TransportEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "feeAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT,
    "vehicleId" TEXT,
    "enrollmentId" TEXT,
    "studentId" TEXT,
    "status" "TransportBoardingStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportStudentAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "pickupDirection" "TransportTripDirection" NOT NULL DEFAULT 'PICKUP',
    "status" "TransportEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportStudentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTrip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverAssignmentId" TEXT NOT NULL,
    "direction" "TransportTripDirection" NOT NULL,
    "status" "TransportTripStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTripStudentStatus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentAssignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "status" "TransportStudentTripStatus" NOT NULL DEFAULT 'PENDING',
    "boardedAt" TIMESTAMP(3),
    "droppedAt" TIMESTAMP(3),
    "markedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTripStudentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportLocationPing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverAssignmentId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speedKph" DECIMAL(8,2),
    "heading" DECIMAL(8,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportLocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenMenuItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CanteenMenuItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "isMealItem" BOOLEAN NOT NULL DEFAULT false,
    "allergenTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenMealPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealType" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" "CanteenMealPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "duplicateServingPrevention" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenMealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenStudentEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "status" "CanteenEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenStudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenMealServing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "mealPlanId" TEXT,
    "mealType" TEXT NOT NULL,
    "mealDate" DATE NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CanteenMealServingStatus" NOT NULL DEFAULT 'SERVED',
    "servedByUserId" TEXT,
    "dietaryWarning" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenMealServing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenWallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lowBalanceThreshold" DECIMAL(12,2) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenWalletTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "CanteenWalletTransactionType" NOT NULL,
    "source" "CanteenWalletTransactionSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenPosSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "walletId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "CanteenPaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "CanteenPosSaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenPosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenPosSaleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenPosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenSpendingControl" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dailySpendingLimit" DECIMAL(12,2),
    "blockedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedMenuItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lowBalanceThreshold" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenSpendingControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingReportAccountMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mappingType" "AccountingReportMappingType" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AccountingReportAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledById" TEXT,
    "journalLineId" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_scopeId_key" ON "UserRole"("userId", "roleId", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSetting_tenantId_key_key" ON "TenantSetting"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_objectKey_key" ON "FileAsset"("objectKey");

-- CreateIndex
CREATE INDEX "FileAsset_tenantId_module_entityId_idx" ON "FileAsset"("tenantId", "module", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_tenantId_name_key" ON "AcademicYear"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Class_tenantId_name_key" ON "Class"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Section_tenantId_classId_name_key" ON "Section"("tenantId", "classId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_tenantId_classId_code_key" ON "Subject"("tenantId", "classId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_photoFileId_key" ON "Student"("photoFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_qrCode_key" ON "Student"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentIdentityCode_key" ON "Student"("studentIdentityCode");

-- CreateIndex
CREATE INDEX "Student_tenantId_classId_sectionId_idx" ON "Student"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_studentSystemId_key" ON "Student"("tenantId", "studentSystemId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_tenantId_primaryPhone_key" ON "Guardian"("tenantId", "primaryPhone");

-- CreateIndex
CREATE INDEX "GuardianIdentityVerification_tenantId_guardianId_status_idx" ON "GuardianIdentityVerification"("tenantId", "guardianId", "status");

-- CreateIndex
CREATE INDEX "GuardianIdentityVerification_tenantId_status_createdAt_idx" ON "GuardianIdentityVerification"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_tenantId_studentId_academicYearId_key" ON "Enrollment"("tenantId", "studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "Staff_tenantId_status_idx" ON "Staff"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Staff_tenantId_department_idx" ON "Staff"("tenantId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_tenantId_employeeId_key" ON "Staff"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_tenantId_staffCode_key" ON "Staff"("tenantId", "staffCode");

-- CreateIndex
CREATE INDEX "StaffQualification_tenantId_staffId_idx" ON "StaffQualification"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "StaffExperienceRecord_tenantId_staffId_idx" ON "StaffExperienceRecord"("tenantId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_tenantId_attendanceDate_classId_sectionId_key" ON "AttendanceSession"("tenantId", "attendanceDate", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_attendanceSessionId_studentId_key" ON "AttendanceRecord"("attendanceSessionId", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_tenantId_status_idx" ON "AttendanceCorrectionRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_tenantId_studentId_attendanceDa_idx" ON "AttendanceCorrectionRequest"("tenantId", "studentId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_tenantId_staffId_attendanceDate_key" ON "StaffAttendance"("tenantId", "staffId", "attendanceDate");

-- CreateIndex
CREATE INDEX "SchoolCalendarDay_tenantId_isWorkingDay_idx" ON "SchoolCalendarDay"("tenantId", "isWorkingDay");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarDay_tenantId_calendarDate_key" ON "SchoolCalendarDay"("tenantId", "calendarDate");

-- CreateIndex
CREATE INDEX "StaffLeaveBalance_tenantId_staffId_idx" ON "StaffLeaveBalance"("tenantId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveBalance_tenantId_staffId_leaveType_year_key" ON "StaffLeaveBalance"("tenantId", "staffId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_staffId_status_idx" ON "StaffLeaveRequest"("tenantId", "staffId", "status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_startsOn_endsOn_idx" ON "StaffLeaveRequest"("tenantId", "startsOn", "endsOn");

-- CreateIndex
CREATE UNIQUE INDEX "FeeHead_tenantId_code_key" ON "FeeHead"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlan_tenantId_code_key" ON "FeePlan"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FeePlanItem_feePlanId_feeHeadId_key" ON "FeePlanItem"("feePlanId", "feeHeadId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAssignment_studentId_feePlanId_academicYearId_key" ON "StudentFeeAssignment"("studentId", "feePlanId", "academicYearId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_dueDate_idx" ON "Invoice"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_tenantId_method_referenceNumber_idx" ON "Payment"("tenantId", "method", "referenceNumber");

-- CreateIndex
CREATE INDEX "Payment_tenantId_paidAt_status_idx" ON "Payment"("tenantId", "paidAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentRefund_tenantId_refundDate_idx" ON "PaymentRefund"("tenantId", "refundDate");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_tenantId_refundNumber_key" ON "PaymentRefund"("tenantId", "refundNumber");

-- CreateIndex
CREATE INDEX "CashierClose_tenantId_openedAt_closedAt_idx" ON "CashierClose"("tenantId", "openedAt", "closedAt");

-- CreateIndex
CREATE INDEX "CashierClose_tenantId_collectorUserId_paymentMethod_idx" ON "CashierClose"("tenantId", "collectorUserId", "paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "CashierClose_tenantId_closeNumber_key" ON "CashierClose"("tenantId", "closeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_tenantId_receiptNumber_key" ON "Receipt"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "ReceiptReprintHistory_tenantId_receiptId_idx" ON "ReceiptReprintHistory"("tenantId", "receiptId");

-- CreateIndex
CREATE INDEX "FeeDueSchedule_tenantId_academicYearId_isActive_idx" ON "FeeDueSchedule"("tenantId", "academicYearId", "isActive");

-- CreateIndex
CREATE INDEX "ChartAccount_tenantId_fiscalYearId_idx" ON "ChartAccount"("tenantId", "fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartAccount_tenantId_code_key" ON "ChartAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_entryDate_idx" ON "JournalEntry"("tenantId", "status", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_postedAt_idx" ON "JournalEntry"("tenantId", "status", "postedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_status_submittedAt_idx" ON "JournalEntry"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_reversalOfId_idx" ON "JournalEntry"("tenantId", "reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalYearId_fiscalPeriodId_postedAt_idx" ON "JournalEntry"("tenantId", "fiscalYearId", "fiscalPeriodId", "postedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalYearId_fiscalPeriodId_status_idx" ON "JournalEntry"("tenantId", "fiscalYearId", "fiscalPeriodId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalYearId_idx" ON "JournalEntry"("tenantId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalPeriodId_idx" ON "JournalEntry"("tenantId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_fiscalYearId_entryNumber_key" ON "JournalEntry"("tenantId", "fiscalYearId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_sourceModule_sourceType_sourceId_post_key" ON "JournalEntry"("tenantId", "sourceModule", "sourceType", "sourceId", "postingType");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_journalEntryId_idx" ON "JournalLine"("tenantId", "journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_tenantId_chartAccountId_idx" ON "JournalLine"("tenantId", "chartAccountId");

-- CreateIndex
CREATE INDEX "FiscalYear_tenantId_startDate_endDate_idx" ON "FiscalYear"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "FiscalYear_tenantId_status_idx" ON "FiscalYear"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_tenantId_name_key" ON "FiscalYear"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_startDate_endDate_idx" ON "FiscalPeriod"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_status_idx" ON "FiscalPeriod"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_fiscalYearId_status_idx" ON "FiscalPeriod"("tenantId", "fiscalYearId", "status");

-- CreateIndex
CREATE INDEX "FiscalPeriod_tenantId_status_startDate_endDate_idx" ON "FiscalPeriod"("tenantId", "status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_tenantId_fiscalYearId_periodNumber_key" ON "FiscalPeriod"("tenantId", "fiscalYearId", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_tenantId_fiscalYearId_label_key" ON "FiscalPeriod"("tenantId", "fiscalYearId", "label");

-- CreateIndex
CREATE INDEX "StudentDocument_tenantId_studentId_idx" ON "StudentDocument"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_tenantId_fileId_idx" ON "StudentDocument"("tenantId", "fileId");

-- CreateIndex
CREATE INDEX "StudentMergeHistory_tenantId_sourceStudentId_idx" ON "StudentMergeHistory"("tenantId", "sourceStudentId");

-- CreateIndex
CREATE INDEX "StudentMergeHistory_tenantId_targetStudentId_idx" ON "StudentMergeHistory"("tenantId", "targetStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentIdentity_identityCode_key" ON "StudentIdentity"("identityCode");

-- CreateIndex
CREATE INDEX "StudentIdentity_tenantId_studentId_idx" ON "StudentIdentity"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentIdentity_tenantId_identityCode_idx" ON "StudentIdentity"("tenantId", "identityCode");

-- CreateIndex
CREATE INDEX "GeneratedStudentDocument_tenantId_studentId_kind_idx" ON "GeneratedStudentDocument"("tenantId", "studentId", "kind");

-- CreateIndex
CREATE INDEX "StudentLifecycleTransition_tenantId_studentId_changedAt_idx" ON "StudentLifecycleTransition"("tenantId", "studentId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiblingGroup_tenantId_name_key" ON "SiblingGroup"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SiblingGroupMember_siblingGroupId_studentId_key" ON "SiblingGroupMember"("siblingGroupId", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceConflict_tenantId_attendanceSessionId_idx" ON "AttendanceConflict"("tenantId", "attendanceSessionId");

-- CreateIndex
CREATE INDEX "AttendanceSyncSubmission_tenantId_syncStatus_attendanceDate_idx" ON "AttendanceSyncSubmission"("tenantId", "syncStatus", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceSyncSubmission_tenantId_academicYearId_classId_se_idx" ON "AttendanceSyncSubmission"("tenantId", "academicYearId", "classId", "sectionId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSyncSubmission_tenantId_clientSubmissionId_key" ON "AttendanceSyncSubmission"("tenantId", "clientSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeBillingRun_tenantId_academicYearId_runMonth_runYear_feeP_key" ON "FeeBillingRun"("tenantId", "academicYearId", "runMonth", "runYear", "feePlanId");

-- CreateIndex
CREATE INDEX "DiscountRule_tenantId_type_isActive_idx" ON "DiscountRule"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "FeeWaiver_tenantId_studentId_status_idx" ON "FeeWaiver"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "ActivityPost_tenantId_classId_sectionId_publishedAt_idx" ON "ActivityPost"("tenantId", "classId", "sectionId", "publishedAt");

-- CreateIndex
CREATE INDEX "ActivityAttachment_tenantId_activityPostId_idx" ON "ActivityAttachment"("tenantId", "activityPostId");

-- CreateIndex
CREATE INDEX "ActivityAttachment_fileAssetId_idx" ON "ActivityAttachment"("fileAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityPostStudent_activityPostId_studentId_key" ON "ActivityPostStudent"("activityPostId", "studentId");

-- CreateIndex
CREATE INDEX "ActivityReaction_tenantId_activityPostId_idx" ON "ActivityReaction"("tenantId", "activityPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_activityPostId_guardianId_reaction_key" ON "ActivityReaction"("activityPostId", "guardianId", "reaction");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_activityPostId_studentId_reaction_key" ON "ActivityReaction"("activityPostId", "studentId", "reaction");

-- CreateIndex
CREATE INDEX "DevelopmentalMilestone_tenantId_studentId_observedAt_idx" ON "DevelopmentalMilestone"("tenantId", "studentId", "observedAt");

-- CreateIndex
CREATE INDEX "DevelopmentalMilestone_tenantId_classId_sectionId_idx" ON "DevelopmentalMilestone"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "MoodLog_tenantId_classId_sectionId_logDate_idx" ON "MoodLog"("tenantId", "classId", "sectionId", "logDate");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_sourceType_sourceId_idx" ON "NotificationDelivery"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_recipientUserId_idx" ON "NotificationDelivery"("tenantId", "recipientUserId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_createdAt_idx" ON "NotificationDelivery"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_channel_idx" ON "NotificationDelivery"("tenantId", "status", "channel");

-- CreateIndex
CREATE INDEX "NotificationReadReceipt_tenantId_userId_readAt_idx" ON "NotificationReadReceipt"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationReadReceipt_tenantId_notificationDeliveryId_use_idx" ON "NotificationReadReceipt"("tenantId", "notificationDeliveryId", "userId");

-- CreateIndex
CREATE INDEX "GuardianConsent_tenantId_guardianId_consentType_idx" ON "GuardianConsent"("tenantId", "guardianId", "consentType");

-- CreateIndex
CREATE INDEX "SubjectTeacherAssignment_tenantId_classId_sectionId_idx" ON "SubjectTeacherAssignment"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectTeacherAssignment_tenantId_academicYearId_subjectId__key" ON "SubjectTeacherAssignment"("tenantId", "academicYearId", "subjectId", "staffId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTerm_tenantId_academicYearId_name_key" ON "ExamTerm"("tenantId", "academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentComponent_tenantId_examTermId_subjectId_name_key" ON "AssessmentComponent"("tenantId", "examTermId", "subjectId", "name");

-- CreateIndex
CREATE INDEX "MarkEntry_tenantId_examTermId_studentId_idx" ON "MarkEntry"("tenantId", "examTermId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MarkEntry_tenantId_assessmentComponentId_studentId_key" ON "MarkEntry"("tenantId", "assessmentComponentId", "studentId");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_academicYearId_studentId_idx" ON "CasRecord"("tenantId", "academicYearId", "studentId");

-- CreateIndex
CREATE INDEX "ReportCard_tenantId_classId_sectionId_idx" ON "ReportCard"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_tenantId_academicYearId_examTermId_studentId_key" ON "ReportCard"("tenantId", "academicYearId", "examTermId", "studentId");

-- CreateIndex
CREATE INDEX "ExamTimetableSlot_tenantId_examTermId_classId_sectionId_idx" ON "ExamTimetableSlot"("tenantId", "examTermId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "MarkLockRequest_tenantId_examTermId_status_idx" ON "MarkLockRequest"("tenantId", "examTermId", "status");

-- CreateIndex
CREATE INDEX "PromotionRecord_tenantId_academicYearId_studentId_idx" ON "PromotionRecord"("tenantId", "academicYearId", "studentId");

-- CreateIndex
CREATE INDEX "TimetablePeriod_tenantId_academicYearId_dayOfWeek_sortOrder_idx" ON "TimetablePeriod"("tenantId", "academicYearId", "dayOfWeek", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriod_tenantId_academicYearId_name_key" ON "TimetablePeriod"("tenantId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "Room_tenantId_isActive_idx" ON "Room"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Room_tenantId_name_key" ON "Room"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TimetableVersion_tenantId_academicYearId_classId_sectionId__idx" ON "TimetableVersion"("tenantId", "academicYearId", "classId", "sectionId", "status");

-- CreateIndex
CREATE INDEX "TimetableVersion_tenantId_status_effectiveFrom_effectiveTo_idx" ON "TimetableVersion"("tenantId", "status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_academicYearId_classId_sectionId_day_idx" ON "TimetableSlot"("tenantId", "academicYearId", "classId", "sectionId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_staffId_dayOfWeek_idx" ON "TimetableSlot"("tenantId", "staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_roomId_dayOfWeek_idx" ON "TimetableSlot"("tenantId", "roomId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_classId_sectionId_idx" ON "TimetableSlot"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_versionId_idx" ON "TimetableSlot"("tenantId", "versionId");

-- CreateIndex
CREATE INDEX "TeacherAvailability_tenantId_staffId_dayOfWeek_idx" ON "TeacherAvailability"("tenantId", "staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TeacherAvailability_tenantId_academicYearId_staffId_idx" ON "TeacherAvailability"("tenantId", "academicYearId", "staffId");

-- CreateIndex
CREATE INDEX "TeacherWorkloadLimit_tenantId_staffId_idx" ON "TeacherWorkloadLimit"("tenantId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherWorkloadLimit_tenantId_academicYearId_staffId_key" ON "TeacherWorkloadLimit"("tenantId", "academicYearId", "staffId");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_tenantId_date_status_idx" ON "TimetableSubstitution"("tenantId", "date", "status");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_tenantId_absentTeacherId_date_idx" ON "TimetableSubstitution"("tenantId", "absentTeacherId", "date");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_tenantId_substituteTeacherId_date_idx" ON "TimetableSubstitution"("tenantId", "substituteTeacherId", "date");

-- CreateIndex
CREATE INDEX "HomeworkReminderBatch_tenantId_homeworkId_createdAt_idx" ON "HomeworkReminderBatch"("tenantId", "homeworkId", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_academicYearId_classId_sectionI_idx" ON "HomeworkAssignment"("tenantId", "academicYearId", "classId", "sectionId", "status");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_status_dueDate_idx" ON "HomeworkAssignment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_classId_sectionId_idx" ON "HomeworkAssignment"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_subjectId_assignedByStaffId_sta_idx" ON "HomeworkAssignment"("tenantId", "subjectId", "assignedByStaffId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_homeworkId_status_idx" ON "HomeworkSubmission"("tenantId", "homeworkId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_studentId_status_idx" ON "HomeworkSubmission"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_studentId_idx" ON "HomeworkSubmission"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_tenantId_homeworkId_studentId_key" ON "HomeworkSubmission"("tenantId", "homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_tenantId_submissionId_idx" ON "HomeworkAttachment"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_tenantId_assignmentId_idx" ON "HomeworkAttachment"("tenantId", "assignmentId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_tenantId_fileAssetId_idx" ON "HomeworkAttachment"("tenantId", "fileAssetId");

-- CreateIndex
CREATE INDEX "SyllabusTopic_tenantId_subjectId_idx" ON "SyllabusTopic"("tenantId", "subjectId");

-- CreateIndex
CREATE INDEX "StaffContract_tenantId_staffId_status_idx" ON "StaffContract"("tenantId", "staffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffContract_tenantId_contractNumber_key" ON "StaffContract"("tenantId", "contractNumber");

-- CreateIndex
CREATE INDEX "SalaryStructure_tenantId_staffId_status_idx" ON "SalaryStructure"("tenantId", "staffId", "status");

-- CreateIndex
CREATE INDEX "SalaryStructure_tenantId_effectiveFrom_effectiveTo_idx" ON "SalaryStructure"("tenantId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SalaryComponent_tenantId_salaryStructureId_idx" ON "SalaryComponent"("tenantId", "salaryStructureId");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_status_idx" ON "PayrollRun"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_periodMonth_periodYear_key" ON "PayrollRun"("tenantId", "periodMonth", "periodYear");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_tenantId_payrollRunId_staffId_key" ON "PayrollLine"("tenantId", "payrollRunId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollLineId_key" ON "Payslip"("payrollLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_tenantId_payslipNumber_key" ON "Payslip"("tenantId", "payslipNumber");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_status_idx" ON "AccountingPeriod"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_name_key" ON "AccountingPeriod"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_type_classId_sectionId_idx" ON "Conversation"("tenantId", "type", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_studentId_academicYearId_idx" ON "Conversation"("tenantId", "studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_tenantId_conversationId_idx" ON "ConversationParticipant"("tenantId", "conversationId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_tenantId_conversationId_createdAt_idx" ON "ConversationParticipant"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_tenantId_conversationId_createdAt_idx" ON "Message"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_tenantId_messageId_idx" ON "MessageReadReceipt"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "ParentTeacherThread_tenantId_studentId_academicYearId_idx" ON "ParentTeacherThread"("tenantId", "studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "ParentTeacherThread_tenantId_guardianId_idx" ON "ParentTeacherThread"("tenantId", "guardianId");

-- CreateIndex
CREATE INDEX "ParentTeacherThread_tenantId_classTeacherId_idx" ON "ParentTeacherThread"("tenantId", "classTeacherId");

-- CreateIndex
CREATE INDEX "ParentTeacherThread_tenantId_status_updatedAt_idx" ON "ParentTeacherThread"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ParentTeacherMessage_tenantId_threadId_createdAt_idx" ON "ParentTeacherMessage"("tenantId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentTeacherMessage_tenantId_status_updatedAt_idx" ON "ParentTeacherMessage"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatAvailabilityRule_tenantId_dayOfWeek_idx" ON "ChatAvailabilityRule"("tenantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAvailabilityRule_tenantId_dayOfWeek_appliesToRole_key" ON "ChatAvailabilityRule"("tenantId", "dayOfWeek", "appliesToRole");

-- CreateIndex
CREATE INDEX "ChatEscalation_tenantId_threadId_createdAt_idx" ON "ChatEscalation"("tenantId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatEscalation_tenantId_status_createdAt_idx" ON "ChatEscalation"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ChatAbuseReport_tenantId_threadId_createdAt_idx" ON "ChatAbuseReport"("tenantId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatAbuseReport_tenantId_status_createdAt_idx" ON "ChatAbuseReport"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryBook_tenantId_title_idx" ON "LibraryBook"("tenantId", "title");

-- CreateIndex
CREATE INDEX "LibraryBook_tenantId_author_idx" ON "LibraryBook"("tenantId", "author");

-- CreateIndex
CREATE INDEX "LibraryBook_tenantId_subjectCategory_idx" ON "LibraryBook"("tenantId", "subjectCategory");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBook_tenantId_isbn_key" ON "LibraryBook"("tenantId", "isbn");

-- CreateIndex
CREATE INDEX "LibraryCopy_tenantId_bookId_status_idx" ON "LibraryCopy"("tenantId", "bookId", "status");

-- CreateIndex
CREATE INDEX "LibraryCopy_tenantId_barcode_idx" ON "LibraryCopy"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "LibraryCopy_tenantId_status_idx" ON "LibraryCopy"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_tenantId_barcode_key" ON "LibraryCopy"("tenantId", "barcode");

-- CreateIndex
CREATE INDEX "LibraryIssue_tenantId_status_dueAt_idx" ON "LibraryIssue"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "LibraryIssue_tenantId_borrowerStudentId_idx" ON "LibraryIssue"("tenantId", "borrowerStudentId");

-- CreateIndex
CREATE INDEX "LibraryIssue_tenantId_borrowerStaffId_idx" ON "LibraryIssue"("tenantId", "borrowerStaffId");

-- CreateIndex
CREATE INDEX "LibraryIssue_tenantId_dueAt_idx" ON "LibraryIssue"("tenantId", "dueAt");

-- CreateIndex
CREATE INDEX "LibraryIssue_tenantId_copyId_status_idx" ON "LibraryIssue"("tenantId", "copyId", "status");

-- CreateIndex
CREATE INDEX "TransportRoute_tenantId_isActive_idx" ON "TransportRoute"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TransportRoute_tenantId_code_idx" ON "TransportRoute"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TransportRoute_tenantId_name_idx" ON "TransportRoute"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_tenantId_code_key" ON "TransportRoute"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_tenantId_name_key" ON "TransportRoute"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TransportStop_tenantId_routeId_idx" ON "TransportStop"("tenantId", "routeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_tenantId_routeId_sequence_key" ON "TransportStop"("tenantId", "routeId", "sequence");

-- CreateIndex
CREATE INDEX "TransportVehicle_tenantId_status_idx" ON "TransportVehicle"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TransportVehicle_tenantId_registrationNumber_idx" ON "TransportVehicle"("tenantId", "registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_tenantId_registrationNumber_key" ON "TransportVehicle"("tenantId", "registrationNumber");

-- CreateIndex
CREATE INDEX "TransportDriverAssignment_tenantId_vehicleId_startsAt_idx" ON "TransportDriverAssignment"("tenantId", "vehicleId", "startsAt");

-- CreateIndex
CREATE INDEX "TransportDriverAssignment_tenantId_staffId_idx" ON "TransportDriverAssignment"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "TransportDriverAssignment_tenantId_vehicleId_idx" ON "TransportDriverAssignment"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "TransportDriverAssignment_tenantId_routeId_idx" ON "TransportDriverAssignment"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "TransportEnrollment_tenantId_routeId_stopId_status_idx" ON "TransportEnrollment"("tenantId", "routeId", "stopId", "status");

-- CreateIndex
CREATE INDEX "TransportEnrollment_tenantId_studentId_status_idx" ON "TransportEnrollment"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "TransportLog_tenantId_routeId_occurredAt_idx" ON "TransportLog"("tenantId", "routeId", "occurredAt");

-- CreateIndex
CREATE INDEX "TransportLog_tenantId_studentId_occurredAt_idx" ON "TransportLog"("tenantId", "studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_tenantId_studentId_idx" ON "TransportStudentAssignment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_tenantId_routeId_idx" ON "TransportStudentAssignment"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_tenantId_stopId_idx" ON "TransportStudentAssignment"("tenantId", "stopId");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_status_idx" ON "TransportTrip"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_routeId_idx" ON "TransportTrip"("tenantId", "routeId");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_vehicleId_idx" ON "TransportTrip"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_startedAt_idx" ON "TransportTrip"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "TransportTripStudentStatus_tenantId_tripId_idx" ON "TransportTripStudentStatus"("tenantId", "tripId");

-- CreateIndex
CREATE INDEX "TransportTripStudentStatus_tenantId_studentId_idx" ON "TransportTripStudentStatus"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportTripStudentStatus_tripId_studentId_key" ON "TransportTripStudentStatus"("tripId", "studentId");

-- CreateIndex
CREATE INDEX "TransportLocationPing_tenantId_tripId_recordedAt_idx" ON "TransportLocationPing"("tenantId", "tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "TransportLocationPing_tenantId_vehicleId_recordedAt_idx" ON "TransportLocationPing"("tenantId", "vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "CanteenMenuItem_tenantId_name_category_idx" ON "CanteenMenuItem"("tenantId", "name", "category");

-- CreateIndex
CREATE INDEX "CanteenMenuItem_tenantId_status_idx" ON "CanteenMenuItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CanteenMealPlan_tenantId_status_idx" ON "CanteenMealPlan"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CanteenStudentEnrollment_tenantId_studentId_idx" ON "CanteenStudentEnrollment"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CanteenStudentEnrollment_tenantId_mealPlanId_status_idx" ON "CanteenStudentEnrollment"("tenantId", "mealPlanId", "status");

-- CreateIndex
CREATE INDEX "CanteenMealServing_tenantId_mealDate_servedAt_idx" ON "CanteenMealServing"("tenantId", "mealDate", "servedAt");

-- CreateIndex
CREATE INDEX "CanteenWallet_tenantId_studentId_idx" ON "CanteenWallet"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenWallet_tenantId_studentId_key" ON "CanteenWallet"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CanteenWalletTransaction_tenantId_walletId_idx" ON "CanteenWalletTransaction"("tenantId", "walletId");

-- CreateIndex
CREATE INDEX "CanteenWalletTransaction_tenantId_transactionDate_idx" ON "CanteenWalletTransaction"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "CanteenPosSale_tenantId_saleDate_idx" ON "CanteenPosSale"("tenantId", "saleDate");

-- CreateIndex
CREATE INDEX "CanteenPosSale_tenantId_status_idx" ON "CanteenPosSale"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CanteenPosSale_tenantId_studentId_idx" ON "CanteenPosSale"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CanteenPosSaleItem_tenantId_saleId_idx" ON "CanteenPosSaleItem"("tenantId", "saleId");

-- CreateIndex
CREATE INDEX "CanteenPosSaleItem_tenantId_menuItemId_idx" ON "CanteenPosSaleItem"("tenantId", "menuItemId");

-- CreateIndex
CREATE INDEX "CanteenSpendingControl_tenantId_studentId_idx" ON "CanteenSpendingControl"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenSpendingControl_tenantId_studentId_key" ON "CanteenSpendingControl"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "AccountingReportAccountMapping_tenantId_mappingType_idx" ON "AccountingReportAccountMapping"("tenantId", "mappingType");

-- CreateIndex
CREATE INDEX "AccountingReportAccountMapping_tenantId_accountId_idx" ON "AccountingReportAccountMapping"("tenantId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingReportAccountMapping_tenantId_mappingType_account_key" ON "AccountingReportAccountMapping"("tenantId", "mappingType", "accountId");

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_accountId_isReconciled_idx" ON "BankStatement"("tenantId", "accountId", "isReconciled");

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_importBatchId_idx" ON "BankStatement"("tenantId", "importBatchId");

-- CreateIndex
CREATE INDEX "BankStatement_tenantId_accountId_statementDate_idx" ON "BankStatement"("tenantId", "accountId", "statementDate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSetting" ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianIdentityVerification" ADD CONSTRAINT "GuardianIdentityVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianIdentityVerification" ADD CONSTRAINT "GuardianIdentityVerification_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffExperienceRecord" ADD CONSTRAINT "StaffExperienceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffExperienceRecord" ADD CONSTRAINT "StaffExperienceRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarDay" ADD CONSTRAINT "SchoolCalendarDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlanItem" ADD CONSTRAINT "FeePlanItem_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingRunId_fkey" FOREIGN KEY ("billingRunId") REFERENCES "FeeBillingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierClose" ADD CONSTRAINT "CashierClose_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierClose" ADD CONSTRAINT "CashierClose_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierClose" ADD CONSTRAINT "CashierClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_reprintedById_fkey" FOREIGN KEY ("reprintedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDueSchedule" ADD CONSTRAINT "FeeDueSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDueSchedule" ADD CONSTRAINT "FeeDueSchedule_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeDueSchedule" ADD CONSTRAINT "FeeDueSchedule_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_sourceStudentId_fkey" FOREIGN KEY ("sourceStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIdentity" ADD CONSTRAINT "StudentIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIdentity" ADD CONSTRAINT "StudentIdentity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocumentHistory" ADD CONSTRAINT "StudentDocumentHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocumentHistory" ADD CONSTRAINT "StudentDocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StudentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedStudentDocument" ADD CONSTRAINT "GeneratedStudentDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedStudentDocument" ADD CONSTRAINT "GeneratedStudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleTransition" ADD CONSTRAINT "StudentLifecycleTransition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleTransition" ADD CONSTRAINT "StudentLifecycleTransition_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingGroup" ADD CONSTRAINT "SiblingGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingGroupMember" ADD CONSTRAINT "SiblingGroupMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingGroupMember" ADD CONSTRAINT "SiblingGroupMember_siblingGroupId_fkey" FOREIGN KEY ("siblingGroupId") REFERENCES "SiblingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiblingGroupMember" ADD CONSTRAINT "SiblingGroupMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceConflict" ADD CONSTRAINT "AttendanceConflict_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceConflict" ADD CONSTRAINT "AttendanceConflict_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSyncSubmission" ADD CONSTRAINT "AttendanceSyncSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeBillingRun" ADD CONSTRAINT "FeeBillingRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeBillingRun" ADD CONSTRAINT "FeeBillingRun_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeBillingRun" ADD CONSTRAINT "FeeBillingRun_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeWaiver" ADD CONSTRAINT "FeeWaiver_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeWaiver" ADD CONSTRAINT "FeeWaiver_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeWaiver" ADD CONSTRAINT "FeeWaiver_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeWaiver" ADD CONSTRAINT "FeeWaiver_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_activityPostId_fkey" FOREIGN KEY ("activityPostId") REFERENCES "ActivityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPostStudent" ADD CONSTRAINT "ActivityPostStudent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPostStudent" ADD CONSTRAINT "ActivityPostStudent_activityPostId_fkey" FOREIGN KEY ("activityPostId") REFERENCES "ActivityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPostStudent" ADD CONSTRAINT "ActivityPostStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_activityPostId_fkey" FOREIGN KEY ("activityPostId") REFERENCES "ActivityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentalMilestone" ADD CONSTRAINT "DevelopmentalMilestone_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_activityPostId_fkey" FOREIGN KEY ("activityPostId") REFERENCES "ActivityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationReadReceipt" ADD CONSTRAINT "NotificationReadReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationReadReceipt" ADD CONSTRAINT "NotificationReadReceipt_notificationDeliveryId_fkey" FOREIGN KEY ("notificationDeliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationReadReceipt" ADD CONSTRAINT "NotificationReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTeacherAssignment" ADD CONSTRAINT "SubjectTeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTerm" ADD CONSTRAINT "ExamTerm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTerm" ADD CONSTRAINT "ExamTerm_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_assessmentComponentId_fkey" FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkEntry" ADD CONSTRAINT "MarkEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasRecord" ADD CONSTRAINT "CasRecord_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetableSlot" ADD CONSTRAINT "ExamTimetableSlot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkLockRequest" ADD CONSTRAINT "MarkLockRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkLockRequest" ADD CONSTRAINT "MarkLockRequest_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkLockRequest" ADD CONSTRAINT "MarkLockRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkLockRequest" ADD CONSTRAINT "MarkLockRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_fromSectionId_fkey" FOREIGN KEY ("fromSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRecord" ADD CONSTRAINT "PromotionRecord_toSectionId_fkey" FOREIGN KEY ("toSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableVersion" ADD CONSTRAINT "TimetableVersion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TimetablePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkloadLimit" ADD CONSTRAINT "TeacherWorkloadLimit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkloadLimit" ADD CONSTRAINT "TeacherWorkloadLimit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_absentTeacherId_fkey" FOREIGN KEY ("absentTeacherId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSubstitution" ADD CONSTRAINT "TimetableSubstitution_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReminderBatch" ADD CONSTRAINT "HomeworkReminderBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkReminderBatch" ADD CONSTRAINT "HomeworkReminderBatch_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_assignedByStaffId_fkey" FOREIGN KEY ("assignedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_completedByStaffId_fkey" FOREIGN KEY ("completedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StaffContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderStaffId_fkey" FOREIGN KEY ("senderStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderGuardianId_fkey" FOREIGN KEY ("senderGuardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentTeacherMessage" ADD CONSTRAINT "ParentTeacherMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEscalation" ADD CONSTRAINT "ChatEscalation_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAbuseReport" ADD CONSTRAINT "ChatAbuseReport_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ParentTeacherThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAbuseReport" ADD CONSTRAINT "ChatAbuseReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ParentTeacherMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryBook" ADD CONSTRAINT "LibraryBook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIssue" ADD CONSTRAINT "LibraryIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIssue" ADD CONSTRAINT "LibraryIssue_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIssue" ADD CONSTRAINT "LibraryIssue_borrowerStudentId_fkey" FOREIGN KEY ("borrowerStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIssue" ADD CONSTRAINT "LibraryIssue_borrowerStaffId_fkey" FOREIGN KEY ("borrowerStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIssue" ADD CONSTRAINT "LibraryIssue_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStop" ADD CONSTRAINT "TransportStop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStop" ADD CONSTRAINT "TransportStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverAssignment" ADD CONSTRAINT "TransportDriverAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverAssignment" ADD CONSTRAINT "TransportDriverAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverAssignment" ADD CONSTRAINT "TransportDriverAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverAssignment" ADD CONSTRAINT "TransportDriverAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEnrollment" ADD CONSTRAINT "TransportEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEnrollment" ADD CONSTRAINT "TransportEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEnrollment" ADD CONSTRAINT "TransportEnrollment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEnrollment" ADD CONSTRAINT "TransportEnrollment_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportEnrollment" ADD CONSTRAINT "TransportEnrollment_feeAssignmentId_fkey" FOREIGN KEY ("feeAssignmentId") REFERENCES "StudentFeeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TransportEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLog" ADD CONSTRAINT "TransportLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_driverAssignmentId_fkey" FOREIGN KEY ("driverAssignmentId") REFERENCES "TransportDriverAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_studentAssignmentId_fkey" FOREIGN KEY ("studentAssignmentId") REFERENCES "TransportStudentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripStudentStatus" ADD CONSTRAINT "TransportTripStudentStatus_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLocationPing" ADD CONSTRAINT "TransportLocationPing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLocationPing" ADD CONSTRAINT "TransportLocationPing_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLocationPing" ADD CONSTRAINT "TransportLocationPing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportLocationPing" ADD CONSTRAINT "TransportLocationPing_driverAssignmentId_fkey" FOREIGN KEY ("driverAssignmentId") REFERENCES "TransportDriverAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMenuItem" ADD CONSTRAINT "CanteenMenuItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealPlan" ADD CONSTRAINT "CanteenMealPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "CanteenMealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CanteenStudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "CanteenMealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_servedByUserId_fkey" FOREIGN KEY ("servedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWallet" ADD CONSTRAINT "CanteenWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWallet" ADD CONSTRAINT "CanteenWallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CanteenWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CanteenWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "CanteenPosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CanteenMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenSpendingControl" ADD CONSTRAINT "CanteenSpendingControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenSpendingControl" ADD CONSTRAINT "CanteenSpendingControl_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReportAccountMapping" ADD CONSTRAINT "AccountingReportAccountMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReportAccountMapping" ADD CONSTRAINT "AccountingReportAccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReportAccountMapping" ADD CONSTRAINT "AccountingReportAccountMapping_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingReportAccountMapping" ADD CONSTRAINT "AccountingReportAccountMapping_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TransportTrip_tenantId_vehicleId_active_key" ON "TransportTrip"("tenantId", "vehicleId") WHERE "status" = 'ACTIVE';
