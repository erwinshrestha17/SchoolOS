import { z } from 'zod';
export declare const tenantRegistrationSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    plan: z.ZodString;
    adminEmail: z.ZodEmail;
    adminPassword: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    tenantSlug: z.ZodString;
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export declare const guardianSchema: z.ZodObject<{
    fullName: z.ZodString;
    relation: z.ZodString;
    primaryPhone: z.ZodString;
    secondaryPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    email: z.ZodNullable<z.ZodOptional<z.ZodEmail>>;
    occupation: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    wardNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const studentDocumentFormSchema: z.ZodObject<{
    kind: z.ZodDefault<z.ZodEnum<{
        OTHER: "OTHER";
        BIRTH_CERTIFICATE: "BIRTH_CERTIFICATE";
        TRANSFER_CERTIFICATE: "TRANSFER_CERTIFICATE";
        PHOTO: "PHOTO";
        ID_CARD: "ID_CARD";
        ENROLLMENT_CONFIRMATION: "ENROLLMENT_CONFIRMATION";
    }>>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    fileName: z.ZodString;
    contentType: z.ZodString;
    base64Content: z.ZodString;
}, z.core.$strip>;
export declare const admissionFormSchema: z.ZodObject<{
    firstNameEn: z.ZodString;
    lastNameEn: z.ZodString;
    firstNameNp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lastNameNp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dateOfBirth: z.ZodString;
    gender: z.ZodString;
    disabilityFlag: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    confirmNoDisability: z.ZodDefault<z.ZodBoolean>;
    admissionDate: z.ZodString;
    academicYearId: z.ZodString;
    classId: z.ZodString;
    sectionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rollNumber: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
    admissionNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    mediumOfInstruction: z.ZodDefault<z.ZodString>;
    guardians: z.ZodArray<z.ZodObject<{
        fullName: z.ZodString;
        relation: z.ZodString;
        primaryPhone: z.ZodString;
        secondaryPhone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        email: z.ZodNullable<z.ZodOptional<z.ZodEmail>>;
        occupation: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        wardNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    documents: z.ZodOptional<z.ZodArray<z.ZodObject<{
        kind: z.ZodDefault<z.ZodEnum<{
            OTHER: "OTHER";
            BIRTH_CERTIFICATE: "BIRTH_CERTIFICATE";
            TRANSFER_CERTIFICATE: "TRANSFER_CERTIFICATE";
            PHOTO: "PHOTO";
            ID_CARD: "ID_CARD";
            ENROLLMENT_CONFIRMATION: "ENROLLMENT_CONFIRMATION";
        }>>;
        title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        fileName: z.ZodString;
        contentType: z.ZodString;
        base64Content: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const academicYearFormSchema: z.ZodObject<{
    name: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    isCurrent: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const classFormSchema: z.ZodObject<{
    name: z.ZodString;
    level: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const sectionFormSchema: z.ZodObject<{
    classId: z.ZodString;
    name: z.ZodString;
    capacity: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNullable<z.ZodCoercedNumber<unknown>>>>;
}, z.core.$strip>;
export declare const attendanceExceptionSchema: z.ZodObject<{
    studentId: z.ZodString;
    status: z.ZodEnum<{
        PRESENT: "PRESENT";
        ABSENT: "ABSENT";
        LATE: "LATE";
        LEAVE: "LEAVE";
        SICK_LEAVE: "SICK_LEAVE";
        EXCUSED_LEAVE: "EXCUSED_LEAVE";
        UNEXCUSED_LEAVE: "UNEXCUSED_LEAVE";
        A: "A";
        P: "P";
        L: "L";
        LS: "LS";
        LE: "LE";
        LU: "LU";
    }>;
    remark: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lateAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const attendanceSubmissionSchema: z.ZodObject<{
    academicYearId: z.ZodString;
    classId: z.ZodString;
    sectionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attendanceDate: z.ZodString;
    exceptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        studentId: z.ZodString;
        status: z.ZodEnum<{
            PRESENT: "PRESENT";
            ABSENT: "ABSENT";
            LATE: "LATE";
            LEAVE: "LEAVE";
            SICK_LEAVE: "SICK_LEAVE";
            EXCUSED_LEAVE: "EXCUSED_LEAVE";
            UNEXCUSED_LEAVE: "UNEXCUSED_LEAVE";
            A: "A";
            P: "P";
            L: "L";
            LS: "LS";
            LE: "LE";
            LU: "LU";
        }>;
        remark: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        lateAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const attendanceSyncSchema: z.ZodObject<{
    academicYearId: z.ZodString;
    classId: z.ZodString;
    sectionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    attendanceDate: z.ZodString;
    exceptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        studentId: z.ZodString;
        status: z.ZodEnum<{
            PRESENT: "PRESENT";
            ABSENT: "ABSENT";
            LATE: "LATE";
            LEAVE: "LEAVE";
            SICK_LEAVE: "SICK_LEAVE";
            EXCUSED_LEAVE: "EXCUSED_LEAVE";
            UNEXCUSED_LEAVE: "UNEXCUSED_LEAVE";
            A: "A";
            P: "P";
            L: "L";
            LS: "LS";
            LE: "LE";
            LU: "LU";
        }>;
        remark: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        lateAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>>;
    clientSubmissionId: z.ZodString;
    deviceTimestamp: z.ZodString;
    deviceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    deviceLabel: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sessionFingerprint: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const attendanceConflictReviewSchema: z.ZodObject<{
    decision: z.ZodDefault<z.ZodEnum<{
        REVIEWED_WITHOUT_CHANGE: "REVIEWED_WITHOUT_CHANGE";
        REJECTED_RESUBMISSION: "REJECTED_RESUBMISSION";
    }>>;
    resolutionNote: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const feeHeadFormSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    frequency: z.ZodDefault<z.ZodEnum<{
        ONE_TIME: "ONE_TIME";
        MONTHLY: "MONTHLY";
        TERM: "TERM";
        ANNUAL: "ANNUAL";
    }>>;
    defaultAmount: z.ZodCoercedNumber<unknown>;
    vatApplicable: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const feePlanFormSchema: z.ZodObject<{
    academicYearId: z.ZodString;
    classId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    code: z.ZodString;
    name: z.ZodString;
    feeHeadId: z.ZodString;
    amount: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const paymentCollectionSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    amount: z.ZodCoercedNumber<unknown>;
    method: z.ZodDefault<z.ZodEnum<{
        CASH: "CASH";
        BANK: "BANK";
        CHEQUE: "CHEQUE";
        TRANSFER: "TRANSFER";
        MOBILE: "MOBILE";
    }>>;
    referenceNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    narration: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const paymentRefundSchema: z.ZodObject<{
    amount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    reason: z.ZodString;
    refundDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    referenceNumber: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    narration: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const cashierCloseWindowSchema: z.ZodObject<{
    openedAt: z.ZodString;
    closedAt: z.ZodString;
    collectorUserId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    paymentMethod: z.ZodNullable<z.ZodOptional<z.ZodEnum<{
        CASH: "CASH";
        BANK: "BANK";
        CHEQUE: "CHEQUE";
        TRANSFER: "TRANSFER";
        MOBILE: "MOBILE";
    }>>>;
}, z.core.$strip>;
export declare const cashierCloseCreateSchema: z.ZodObject<{
    openedAt: z.ZodString;
    closedAt: z.ZodString;
    collectorUserId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    paymentMethod: z.ZodNullable<z.ZodOptional<z.ZodEnum<{
        CASH: "CASH";
        BANK: "BANK";
        CHEQUE: "CHEQUE";
        TRANSFER: "TRANSFER";
        MOBILE: "MOBILE";
    }>>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const reconciliationQuerySchema: z.ZodObject<{
    openedAt: z.ZodString;
    closedAt: z.ZodString;
    collectorUserId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    paymentMethod: z.ZodNullable<z.ZodOptional<z.ZodEnum<{
        CASH: "CASH";
        BANK: "BANK";
        CHEQUE: "CHEQUE";
        TRANSFER: "TRANSFER";
        MOBILE: "MOBILE";
    }>>>;
    studentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    classId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    format: z.ZodNullable<z.ZodOptional<z.ZodEnum<{
        json: "json";
        csv: "csv";
    }>>>;
}, z.core.$strip>;
export declare const discountRuleFormSchema: z.ZodObject<{
    name: z.ZodString;
    reason: z.ZodString;
    type: z.ZodEnum<{
        MANUAL: "MANUAL";
        SIBLING: "SIBLING";
        SCHOLARSHIP: "SCHOLARSHIP";
        STAFF_CHILD: "STAFF_CHILD";
    }>;
    feeHeadId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    classId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    feePlanId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    percentOff: z.ZodNullable<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    amountOff: z.ZodNullable<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const feeWaiverFormSchema: z.ZodObject<{
    studentId: z.ZodString;
    invoiceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    feeHeadId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodCoercedNumber<unknown>;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const activityPostFormSchema: z.ZodObject<{
    classId: z.ZodString;
    sectionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    caption: z.ZodString;
    category: z.ZodDefault<z.ZodEnum<{
        GENERAL: "GENERAL";
        LEARNING: "LEARNING";
        OUTDOOR_PLAY: "OUTDOOR_PLAY";
        ART_AND_CRAFT: "ART_AND_CRAFT";
        CELEBRATION: "CELEBRATION";
        SPORTS: "SPORTS";
    }>>;
    studentIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    attachments: z.ZodArray<z.ZodObject<{
        fileName: z.ZodString;
        contentType: z.ZodString;
        base64Content: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const moodLogFormSchema: z.ZodObject<{
    classId: z.ZodString;
    sectionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    studentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    mood: z.ZodEnum<{
        CALM: "CALM";
        ENGAGED: "ENGAGED";
        EXCITED: "EXCITED";
        UNSETTLED: "UNSETTLED";
        TIRED: "TIRED";
    }>;
    note: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    logDate: z.ZodString;
}, z.core.$strip>;
export type TenantRegistrationInput = z.input<typeof tenantRegistrationSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type AdmissionFormInput = z.input<typeof admissionFormSchema>;
export type AcademicYearFormInput = z.input<typeof academicYearFormSchema>;
export type ClassFormInput = z.input<typeof classFormSchema>;
export type SectionFormInput = z.input<typeof sectionFormSchema>;
export type AttendanceSubmissionInput = z.input<typeof attendanceSubmissionSchema>;
export type AttendanceSyncInput = z.input<typeof attendanceSyncSchema>;
export type AttendanceConflictReviewInput = z.input<typeof attendanceConflictReviewSchema>;
export type FeeHeadFormInput = z.input<typeof feeHeadFormSchema>;
export type FeePlanFormInput = z.input<typeof feePlanFormSchema>;
export type PaymentCollectionInput = z.input<typeof paymentCollectionSchema>;
export type PaymentRefundInput = z.input<typeof paymentRefundSchema>;
export type CashierCloseWindowInput = z.input<typeof cashierCloseWindowSchema>;
export type CashierCloseCreateInput = z.input<typeof cashierCloseCreateSchema>;
export type ReconciliationQueryInput = z.input<typeof reconciliationQuerySchema>;
export type DiscountRuleFormInput = z.input<typeof discountRuleFormSchema>;
export type FeeWaiverFormInput = z.input<typeof feeWaiverFormSchema>;
export type ActivityPostFormInput = z.input<typeof activityPostFormSchema>;
export type MoodLogFormInput = z.input<typeof moodLogFormSchema>;
