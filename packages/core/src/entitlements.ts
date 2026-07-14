export enum SubscriptionTier {
  STARTER = 'STARTER',
  STANDARD = 'STANDARD',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export const CUSTOMER_TIERS = [
  SubscriptionTier.STARTER,
  SubscriptionTier.STANDARD,
  SubscriptionTier.PROFESSIONAL,
  SubscriptionTier.ENTERPRISE,
];

// Customer Modules only (excl M0). Module keys remain stable even when display numbering changes.
export const CUSTOMER_MODULES = [
  'students', // M1 Admissions & Student Profiles
  'attendance', // M2 Smart Attendance
  'fees', // M3 Fees & Receipts
  'exams', // M4 Exams / CAS / Report Cards
  'activity', // M5 Activity Feed & Milestones
  'homework', // M6 Homework & Timetable
  'hr', // M7 HR & Payroll
  'library', // M8 Library
  'transport', // M9 Transport
  'canteen', // M10 Canteen
  'accounting', // M11 Accounting & Finance
  'notifications', // M12 Notifications & Delivery
  'notices', // M15 Notices & Announcements (stable key retained)
  'learning', // M13 Learning Layer
];

export const FEATURE_KEYS = {
  // M3 Fees & Receipts
  FEES_BASIC: 'feature.fees.basic',
  FEES_FULL: 'feature.fees.full',
  FEES_REVERSALS: 'feature.fees.reversals',
  FEES_CASHIER_CLOSE: 'feature.fees.cashier_close',
  FEES_DEFAULTER_AGING: 'feature.fees.defaulter_aging',

  // M4 Exams / CAS / Report Cards
  EXAMS_BASIC: 'feature.exams.basic',
  EXAMS_FULL: 'feature.exams.full',
  EXAMS_CUSTOM_TEMPLATES: 'feature.exams.custom_templates',

  // M5 Activity Feed & Milestones
  ACTIVITY_BASIC: 'feature.activity.basic',
  ACTIVITY_FULL: 'feature.activity.full',
  ACTIVITY_MODERATION: 'feature.activity.moderation',
  ACTIVITY_CONSENT_MEDIA: 'feature.activity.consent_media',

  // M6 Homework & Timetable
  HOMEWORK_BASIC: 'feature.homework.basic',
  HOMEWORK_FULL: 'feature.homework.full',
  TIMETABLE_VIEW: 'feature.timetable.view',
  TIMETABLE_BASIC: 'feature.timetable.basic',
  TIMETABLE_CONFLICTS: 'feature.timetable.conflicts',
  TIMETABLE_ADVANCED: 'feature.timetable.advanced',

  // M13 Learning Layer
  LEARNING_BASIC: 'feature.learning.basic',
  LEARNING_FULL: 'feature.learning.full',

  // M7 HR & Payroll
  HR_STAFF_RECORDS: 'feature.hr.staff_records',
  HR_FULL: 'feature.hr.full',
  HR_SELF_SERVICE: 'feature.hr.self_service',

  // M8 Library
  LIBRARY_BASIC: 'feature.library.basic',
  LIBRARY_FULL: 'feature.library.full',

  // M9 Transport
  TRANSPORT_BASIC: 'feature.transport.basic',
  TRANSPORT_FULL: 'feature.transport.full',
  GPS_LIVE_TRACKING: 'feature.transport.gps_live',

  // M10 Canteen
  CANTEEN_BASIC: 'feature.canteen.basic',
  CANTEEN_FULL: 'feature.canteen.full',
  CANTEEN_WALLET_CONTROLS: 'feature.canteen.wallet_controls',

  // M11 Accounting & Finance
  ACCOUNTING_BASIC_FINANCE: 'feature.accounting.basic_finance',
  ACCOUNTING_FULL: 'feature.accounting.full',
  ACCOUNTING_AUDIT: 'feature.accounting.audit',

  // M12 Notifications & Delivery
  NOTIFICATIONS_IN_APP: 'feature.notifications.in_app',
  NOTIFICATIONS_PUSH: 'feature.notifications.push',
  NOTIFICATIONS_SMS: 'feature.notifications.sms',
  NOTIFICATIONS_EMAIL: 'feature.notifications.email',
  NOTIFICATIONS_PREFERENCES: 'feature.notifications.preferences',
  NOTIFICATIONS_DELIVERY_DIAGNOSTICS:
    'feature.notifications.delivery_diagnostics',

  // M15 Notices & Announcements. Existing keys remain compatibility-stable.
  NOTICES_BASIC: 'feature.notices.basic',
  NOTICES_FULL: 'feature.notices.full',
  NOTICES_READ_TRACKING: 'feature.notices.read_tracking',

  // Reports
  REPORTS_BASIC: 'feature.reports.basic',
  REPORTS_STANDARD: 'feature.reports.standard',
  REPORTS_ADVANCED: 'feature.reports.advanced',
  REPORTS_CUSTOM: 'feature.reports.custom',

  // Mobile Features
  MOBILE_PARENT_BASIC: 'feature.mobile.parent_basic',
  MOBILE_TEACHER_PARENT: 'feature.mobile.teacher_parent',
  MOBILE_FULL_ROLE: 'feature.mobile.full_role',
  /** @deprecated Chat is deferred; retained only to recognize legacy data. */
  MOBILE_PARENT_TEACHER_CHAT: 'feature.mobile.parent_teacher_chat',

  // Imports/Exports
  IMPORTS_EXPORTS_ADVANCED: 'feature.general.advanced_imports_exports',
};

export const ENTITLEMENT_MATRIX: Record<
  SubscriptionTier,
  {
    modules: string[];
    features: string[];
  }
> = {
  [SubscriptionTier.STARTER]: {
    modules: [
      'students',
      'attendance',
      'fees',
      'exams',
      'activity',
      'homework',
      'notifications',
      'notices',
    ],
    features: [
      FEATURE_KEYS.FEES_BASIC,
      FEATURE_KEYS.EXAMS_BASIC,
      FEATURE_KEYS.ACTIVITY_BASIC,
      FEATURE_KEYS.HOMEWORK_BASIC,
      FEATURE_KEYS.TIMETABLE_VIEW,
      FEATURE_KEYS.NOTIFICATIONS_IN_APP,
      FEATURE_KEYS.NOTICES_BASIC,
      FEATURE_KEYS.REPORTS_BASIC,
      FEATURE_KEYS.MOBILE_PARENT_BASIC,
    ],
  },
  [SubscriptionTier.STANDARD]: {
    modules: [
      'students',
      'attendance',
      'fees',
      'exams',
      'activity',
      'homework',
      'notifications',
      'notices',
    ],
    features: [
      FEATURE_KEYS.FEES_BASIC,
      FEATURE_KEYS.FEES_FULL,
      FEATURE_KEYS.EXAMS_BASIC,
      FEATURE_KEYS.EXAMS_FULL,
      FEATURE_KEYS.ACTIVITY_BASIC,
      FEATURE_KEYS.ACTIVITY_FULL,
      FEATURE_KEYS.HOMEWORK_BASIC,
      FEATURE_KEYS.HOMEWORK_FULL,
      FEATURE_KEYS.TIMETABLE_VIEW,
      FEATURE_KEYS.TIMETABLE_BASIC,
      FEATURE_KEYS.HR_STAFF_RECORDS,
      FEATURE_KEYS.NOTIFICATIONS_IN_APP,
      FEATURE_KEYS.NOTIFICATIONS_PREFERENCES,
      FEATURE_KEYS.NOTICES_BASIC,
      FEATURE_KEYS.NOTICES_FULL,
      FEATURE_KEYS.ACCOUNTING_BASIC_FINANCE,
      FEATURE_KEYS.REPORTS_BASIC,
      FEATURE_KEYS.REPORTS_STANDARD,
      FEATURE_KEYS.MOBILE_PARENT_BASIC,
      FEATURE_KEYS.MOBILE_TEACHER_PARENT,
    ],
  },
  [SubscriptionTier.PROFESSIONAL]: {
    modules: [
      'students',
      'attendance',
      'fees',
      'exams',
      'activity',
      'homework',
      'hr',
      'library',
      'transport',
      'canteen',
      'accounting',
      'notifications',
      'notices',
      'learning',
    ],
    features: [
      FEATURE_KEYS.FEES_BASIC,
      FEATURE_KEYS.FEES_FULL,
      FEATURE_KEYS.FEES_REVERSALS,
      FEATURE_KEYS.FEES_CASHIER_CLOSE,
      FEATURE_KEYS.FEES_DEFAULTER_AGING,
      FEATURE_KEYS.EXAMS_BASIC,
      FEATURE_KEYS.EXAMS_FULL,
      FEATURE_KEYS.ACTIVITY_BASIC,
      FEATURE_KEYS.ACTIVITY_FULL,
      FEATURE_KEYS.ACTIVITY_MODERATION,
      FEATURE_KEYS.HOMEWORK_BASIC,
      FEATURE_KEYS.HOMEWORK_FULL,
      FEATURE_KEYS.LEARNING_BASIC,
      FEATURE_KEYS.LEARNING_FULL,
      FEATURE_KEYS.TIMETABLE_VIEW,
      FEATURE_KEYS.TIMETABLE_BASIC,
      FEATURE_KEYS.TIMETABLE_CONFLICTS,
      FEATURE_KEYS.HR_STAFF_RECORDS,
      FEATURE_KEYS.HR_FULL,
      FEATURE_KEYS.LIBRARY_BASIC,
      FEATURE_KEYS.LIBRARY_FULL,
      FEATURE_KEYS.TRANSPORT_BASIC,
      FEATURE_KEYS.TRANSPORT_FULL,
      FEATURE_KEYS.CANTEEN_BASIC,
      FEATURE_KEYS.CANTEEN_FULL,
      FEATURE_KEYS.NOTIFICATIONS_IN_APP,
      FEATURE_KEYS.NOTIFICATIONS_PUSH,
      FEATURE_KEYS.NOTIFICATIONS_PREFERENCES,
      FEATURE_KEYS.NOTIFICATIONS_DELIVERY_DIAGNOSTICS,
      FEATURE_KEYS.NOTICES_BASIC,
      FEATURE_KEYS.NOTICES_FULL,
      FEATURE_KEYS.NOTICES_READ_TRACKING,
      FEATURE_KEYS.ACCOUNTING_BASIC_FINANCE,
      FEATURE_KEYS.ACCOUNTING_FULL,
      FEATURE_KEYS.REPORTS_BASIC,
      FEATURE_KEYS.REPORTS_STANDARD,
      FEATURE_KEYS.REPORTS_ADVANCED,
      FEATURE_KEYS.MOBILE_PARENT_BASIC,
      FEATURE_KEYS.MOBILE_TEACHER_PARENT,
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    modules: [
      'students',
      'attendance',
      'fees',
      'exams',
      'activity',
      'homework',
      'hr',
      'library',
      'transport',
      'canteen',
      'accounting',
      'notifications',
      'notices',
      'learning',
    ],
    features: [
      FEATURE_KEYS.FEES_BASIC,
      FEATURE_KEYS.FEES_FULL,
      FEATURE_KEYS.FEES_REVERSALS,
      FEATURE_KEYS.FEES_CASHIER_CLOSE,
      FEATURE_KEYS.FEES_DEFAULTER_AGING,
      FEATURE_KEYS.EXAMS_BASIC,
      FEATURE_KEYS.EXAMS_FULL,
      FEATURE_KEYS.EXAMS_CUSTOM_TEMPLATES,
      FEATURE_KEYS.ACTIVITY_BASIC,
      FEATURE_KEYS.ACTIVITY_FULL,
      FEATURE_KEYS.ACTIVITY_MODERATION,
      FEATURE_KEYS.ACTIVITY_CONSENT_MEDIA,
      FEATURE_KEYS.HOMEWORK_BASIC,
      FEATURE_KEYS.HOMEWORK_FULL,
      FEATURE_KEYS.LEARNING_BASIC,
      FEATURE_KEYS.LEARNING_FULL,
      FEATURE_KEYS.TIMETABLE_VIEW,
      FEATURE_KEYS.TIMETABLE_BASIC,
      FEATURE_KEYS.TIMETABLE_CONFLICTS,
      FEATURE_KEYS.TIMETABLE_ADVANCED,
      FEATURE_KEYS.HR_STAFF_RECORDS,
      FEATURE_KEYS.HR_FULL,
      FEATURE_KEYS.HR_SELF_SERVICE,
      FEATURE_KEYS.LIBRARY_BASIC,
      FEATURE_KEYS.LIBRARY_FULL,
      FEATURE_KEYS.TRANSPORT_BASIC,
      FEATURE_KEYS.TRANSPORT_FULL,
      FEATURE_KEYS.CANTEEN_BASIC,
      FEATURE_KEYS.CANTEEN_FULL,
      FEATURE_KEYS.NOTIFICATIONS_IN_APP,
      FEATURE_KEYS.NOTIFICATIONS_PUSH,
      FEATURE_KEYS.NOTIFICATIONS_SMS,
      FEATURE_KEYS.NOTIFICATIONS_EMAIL,
      FEATURE_KEYS.NOTIFICATIONS_PREFERENCES,
      FEATURE_KEYS.NOTIFICATIONS_DELIVERY_DIAGNOSTICS,
      FEATURE_KEYS.NOTICES_BASIC,
      FEATURE_KEYS.NOTICES_FULL,
      FEATURE_KEYS.NOTICES_READ_TRACKING,
      FEATURE_KEYS.ACCOUNTING_BASIC_FINANCE,
      FEATURE_KEYS.ACCOUNTING_FULL,
      FEATURE_KEYS.ACCOUNTING_AUDIT,
      FEATURE_KEYS.REPORTS_BASIC,
      FEATURE_KEYS.REPORTS_STANDARD,
      FEATURE_KEYS.REPORTS_ADVANCED,
      FEATURE_KEYS.REPORTS_CUSTOM,
      FEATURE_KEYS.MOBILE_PARENT_BASIC,
      FEATURE_KEYS.MOBILE_TEACHER_PARENT,
      FEATURE_KEYS.MOBILE_FULL_ROLE,
      FEATURE_KEYS.IMPORTS_EXPORTS_ADVANCED,
      FEATURE_KEYS.GPS_LIVE_TRACKING,
      FEATURE_KEYS.CANTEEN_WALLET_CONTROLS,
    ],
  },
};

// Standard allows add-ons: M8 Library, M9 Transport, M10 Canteen.
export const STANDARD_ALLOWED_ADDONS = ['library', 'transport', 'canteen'];
