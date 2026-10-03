import { permissionCatalog } from "./permissions/catalog.js";

/**
 * Phase 1A's declarative permission identities. Existing guards and persisted
 * grants continue to use legacy keys until their domain migrations. Metadata
 * here does not itself enforce MFA, approval, scope, or resource policy.
 */
export type CanonicalPermissionRiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

/** GLOBAL is reserved for the separate Platform security domain. */
export type CanonicalPermissionScopeType =
  | "GLOBAL"
  | "TENANT"
  | "BRANCH"
  | "ACADEMIC_YEAR"
  | "CLASS"
  | "SECTION"
  | "SUBJECT"
  | "DEPARTMENT"
  | "STUDENT"
  | "STAFF"
  | "FINANCE_ACCOUNT";

type CatalogEntryKey<T> = T extends {
  resource: infer Resource extends string;
  action: infer Action extends string;
}
  ? `${Resource}:${Action}`
  : never;

/** The exact catalog-key union, without the resource × action cross-product. */
export type LegacyCatalogPermissionKey = CatalogEntryKey<
  (typeof permissionCatalog)[number]
>;

type MetadataProfile = Readonly<{
  riskLevel: CanonicalPermissionRiskLevel;
  allowedScopeTypes: readonly [
    CanonicalPermissionScopeType,
    ...CanonicalPermissionScopeType[],
  ];
  delegable: boolean;
  requiresReason: boolean;
  requiresMfa: boolean;
  requiresApproval: boolean;
}>;

/**
 * Every row below selects a reviewed profile. There is deliberately no
 * fallback profile: a newly added legacy key must declare its canonical code
 * and profile before Core will typecheck.
 */
const metadataProfiles = {
  academic_read: {
    riskLevel: "MEDIUM",
    allowedScopeTypes: [
      "TENANT",
      "ACADEMIC_YEAR",
      "CLASS",
      "SECTION",
      "SUBJECT",
    ],
    delegable: true,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  academic_write: {
    riskLevel: "HIGH",
    allowedScopeTypes: [
      "TENANT",
      "ACADEMIC_YEAR",
      "CLASS",
      "SECTION",
      "SUBJECT",
    ],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  academic_approval: {
    riskLevel: "HIGH",
    allowedScopeTypes: [
      "TENANT",
      "ACADEMIC_YEAR",
      "CLASS",
      "SECTION",
      "SUBJECT",
    ],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: false,
  },
  authz_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  authz_manage: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: false,
  },
  finance_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "FINANCE_ACCOUNT"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  finance_write: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "FINANCE_ACCOUNT"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  finance_approval: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "FINANCE_ACCOUNT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: false,
  },
  finance_critical: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT", "FINANCE_ACCOUNT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: true,
  },
  legacy_disabled: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  platform_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["GLOBAL"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  platform_manage: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["GLOBAL"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: false,
  },
  protected_export: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "STUDENT", "STAFF", "FINANCE_ACCOUNT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: true,
  },
  report_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: [
      "TENANT",
      "STUDENT",
      "STAFF",
      "CLASS",
      "SECTION",
      "FINANCE_ACCOUNT",
    ],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  school_privileged: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: false,
  },
  school_read: {
    riskLevel: "MEDIUM",
    allowedScopeTypes: ["TENANT"],
    delegable: true,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  school_write: {
    riskLevel: "MEDIUM",
    allowedScopeTypes: ["TENANT"],
    delegable: true,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  self_service: {
    riskLevel: "LOW",
    allowedScopeTypes: ["TENANT", "STUDENT", "STAFF"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  staff_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "DEPARTMENT", "STAFF"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  staff_write: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "DEPARTMENT", "STAFF"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  staff_approval: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "DEPARTMENT", "STAFF"],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: false,
  },
  staff_lifecycle: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT", "STAFF"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: false,
  },
  // Phase 7.2: medical and safeguarding evidence. Never delegable, never part
  // of a default template, and a reason is required wherever access policy
  // enforces it (the runtime step-up hook itself belongs to Phase 8).
  staff_restricted_read: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT", "STAFF"],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: false,
  },
  staff_restricted_manage: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT", "STAFF"],
    delegable: false,
    requiresReason: true,
    requiresMfa: false,
    requiresApproval: false,
  },
  student_read: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "STUDENT", "CLASS", "SECTION"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  student_write: {
    riskLevel: "HIGH",
    allowedScopeTypes: ["TENANT", "STUDENT", "CLASS", "SECTION"],
    delegable: false,
    requiresReason: false,
    requiresMfa: false,
    requiresApproval: false,
  },
  student_sensitive_write: {
    riskLevel: "CRITICAL",
    allowedScopeTypes: ["TENANT", "STUDENT"],
    delegable: false,
    requiresReason: true,
    requiresMfa: true,
    requiresApproval: false,
  },
} as const satisfies Record<string, MetadataProfile>;

type MetadataProfileName = keyof typeof metadataProfiles;
type CanonicalCode = `${string}:${string}:${string}`;
type MetadataRow = readonly [
  code: CanonicalCode,
  profile: MetadataProfileName,
  introducedVersion: string,
  deprecatedAt?: string | null,
];

/**
 * Exhaustive, manually reviewable legacy → canonical mapping. This object is
 * checked against the exact catalog-key union at compile time; adding a key
 * to the split catalog without adding a row here is a type error. Version
 * 1.0.0 marks the initial canonical catalog, not the legacy key's first use.
 */
const legacyPermissionMetadata = {
  "classes:create": ["academics:classes:create", "academic_write", "1.0.0"],
  "classes:read": ["academics:classes:read", "academic_read", "1.0.0"],
  "streams:create": ["academics:streams:create", "academic_write", "1.0.0"],
  "streams:read": ["academics:streams:read", "academic_read", "1.0.0"],
  "academic_years:create": [
    "academics:academic_years:create",
    "academic_write",
    "1.0.0",
  ],
  "academic_years:read": [
    "academics:academic_years:read",
    "academic_read",
    "1.0.0",
  ],
  "sections:create": ["academics:sections:create", "academic_write", "1.0.0"],
  "sections:read": ["academics:sections:read", "academic_read", "1.0.0"],
  "academics:manage": ["academics:workspace:manage", "academic_write", "1.0.0"],
  "academics:read": ["academics:workspace:read", "academic_read", "1.0.0"],
  "academics:enter_marks": ["academics:marks:enter", "academic_write", "1.0.0"],
  "academics:manage_report_cards": [
    "academics:report_cards:manage",
    "academic_write",
    "1.0.0",
  ],
  "academics:create": ["academics:workspace:create", "academic_write", "1.0.0"],
  "academics:update": ["academics:workspace:update", "academic_write", "1.0.0"],
  "academics:delete": ["academics:workspace:delete", "academic_write", "1.0.0"],
  "exam-terms:read": ["academics:exam_terms:read", "academic_read", "1.0.0"],
  "exam-terms:manage": [
    "academics:exam_terms:manage",
    "academic_write",
    "1.0.0",
  ],
  "exam-terms:unlock": [
    "academics:exam_terms:unlock",
    "academic_approval",
    "1.0.0",
  ],
  "assessment-components:read": [
    "academics:assessment_components:read",
    "academic_read",
    "1.0.0",
  ],
  "assessment-components:manage": [
    "academics:assessment_components:manage",
    "academic_write",
    "1.0.0",
  ],
  "marks:read": ["academics:marks:read", "academic_read", "1.0.0"],
  "marks:manage": ["academics:marks:manage", "academic_write", "1.0.0"],
  "marks:review_lock": [
    "academics:marks:review_lock",
    "academic_approval",
    "1.0.0",
  ],
  "academics:cas:manage": ["academics:cas:manage", "academic_write", "1.0.0"],
  "cas-records:read": ["academics:cas_records:read", "academic_read", "1.0.0"],
  "cas-records:manage": [
    "academics:cas_records:manage",
    "academic_write",
    "1.0.0",
  ],
  "results:read": ["academics:results:read", "academic_read", "1.0.0"],
  "results:publish": [
    "academics:results:publish",
    "academic_approval",
    "1.0.0",
  ],
  "results:unpublish": [
    "academics:results:unpublish",
    "academic_approval",
    "1.0.0",
  ],
  "academics:report_cards:review": [
    "academics:report_cards:review",
    "academic_approval",
    "1.0.0",
  ],
  "timetable:manage": ["timetable:workspace:manage", "academic_write", "1.0.0"],
  "timetable:read_published": [
    "timetable:workspace:read_published",
    "academic_read",
    "1.0.0",
  ],
  "timetable:read": ["timetable:workspace:read", "academic_read", "1.0.0"],
  "timetable:create": ["timetable:workspace:create", "academic_write", "1.0.0"],
  "timetable:update": ["timetable:workspace:update", "academic_write", "1.0.0"],
  "timetable:delete": ["timetable:workspace:delete", "academic_write", "1.0.0"],
  "timetable:publish": [
    "timetable:workspace:publish",
    "academic_approval",
    "1.0.0",
  ],
  "timetable:substitute": [
    "timetable:workspace:substitute",
    "academic_write",
    "1.0.0",
  ],
  "homework:create": ["homework:assignment:create", "academic_write", "1.0.0"],
  "homework:read_published": [
    "homework:assignment:read_published",
    "academic_read",
    "1.0.0",
  ],
  "homework:read": ["homework:assignment:read", "academic_read", "1.0.0"],
  "homework:review": ["homework:assignment:review", "academic_write", "1.0.0"],
  "homework:update": ["homework:assignment:update", "academic_write", "1.0.0"],
  "homework:delete": ["homework:assignment:delete", "academic_write", "1.0.0"],
  "homework:notify": ["homework:assignment:notify", "academic_write", "1.0.0"],
  "homework:submit": ["homework:assignment:submit", "academic_write", "1.0.0"],
  "accounting:read": ["accounting:workspace:read", "finance_read", "1.0.0"],
  "accounting:close": [
    "accounting:workspace:close",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:reverse": [
    "accounting:workspace:reverse",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:accounts:read": [
    "accounting:accounts:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:accounts:write": [
    "accounting:accounts:write",
    "finance_write",
    "1.0.0",
  ],
  "accounting:fiscal:manage": [
    "accounting:fiscal:manage",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:fiscal:reopen": [
    "accounting:fiscal:reopen",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:journals:read": [
    "accounting:journals:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:journals:create": [
    "accounting:journals:create",
    "finance_write",
    "1.0.0",
  ],
  "accounting:journals:submit": [
    "accounting:journals:submit",
    "finance_write",
    "1.0.0",
  ],
  "accounting:journals:review": [
    "accounting:journals:review",
    "finance_write",
    "1.0.0",
  ],
  "accounting:journals:approve": [
    "accounting:journals:approve",
    "finance_approval",
    "1.0.0",
  ],
  "accounting:journals:reject": [
    "accounting:journals:reject",
    "finance_approval",
    "1.0.0",
  ],
  "accounting:journals:post": [
    "accounting:journals:post",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:journals:cancel": [
    "accounting:journals:cancel",
    "finance_approval",
    "1.0.0",
  ],
  "accounting:journals:reverse": [
    "accounting:journals:reverse",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:reports:read": [
    "accounting:reports:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:audit:read": ["accounting:audit:read", "finance_read", "1.0.0"],
  "accounting:reports:trial-balance": [
    "accounting:reports:trial-balance",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:general-ledger": [
    "accounting:reports:general-ledger",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:cash-book": [
    "accounting:reports:cash-book",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:income-statement": [
    "accounting:reports:income-statement",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:balance-sheet": [
    "accounting:reports:balance-sheet",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:tax-summary": [
    "accounting:reports:tax-summary",
    "finance_read",
    "1.0.0",
  ],
  "accounting:settings:read": [
    "accounting:settings:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:settings:update": [
    "accounting:settings:update",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:exports:create": [
    "accounting:exports:create",
    "protected_export",
    "1.0.0",
  ],
  "accounting:posting-batches:read": [
    "accounting:posting-batches:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:posting-batches:retry": [
    "accounting:posting-batches:retry",
    "finance_write",
    "1.0.0",
  ],
  "accounting:payroll-handoff:read": [
    "accounting:payroll-handoff:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:payroll-handoff:post": [
    "accounting:payroll-handoff:post",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:expenses:read": [
    "accounting:expenses:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:expenses:write": [
    "accounting:expenses:write",
    "finance_write",
    "1.0.0",
  ],
  "accounting:vendors:read": [
    "accounting:vendors:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:vendors:write": [
    "accounting:vendors:write",
    "finance_write",
    "1.0.0",
  ],
  "accounting:payables:read": [
    "accounting:payables:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:payables:write": [
    "accounting:payables:write",
    "finance_write",
    "1.0.0",
  ],
  "accounting:reconciliation:read": [
    "accounting:reconciliation:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reconciliation:manage": [
    "accounting:reconciliation:manage",
    "finance_critical",
    "1.0.0",
  ],
  "accounting:reconciliation:review": [
    "accounting:reconciliation:review",
    "finance_approval",
    "1.0.0",
  ],
  "accounting:reconciliation:finalize": [
    "accounting:reconciliation:finalize",
    "finance_critical",
    "1.0.0",
  ],
  "finance:principal:read": ["finance:principal:read", "finance_read", "1.0.0"],
  "finance:approvals:read": ["finance:approvals:read", "finance_read", "1.0.0"],
  "finance:approvals:decide": [
    "finance:approvals:decide",
    "finance_approval",
    "1.0.0",
  ],
  "accounting:budgets:read": [
    "accounting:budgets:read",
    "finance_read",
    "1.0.0",
  ],
  "accounting:budgets:write": [
    "accounting:budgets:write",
    "finance_write",
    "1.0.0",
  ],
  "accounting:reports:budget-vs-actual": [
    "accounting:reports:budget-vs-actual",
    "finance_read",
    "1.0.0",
  ],
  "accounting:reports:cash-flow-statement": [
    "accounting:reports:cash-flow-statement",
    "finance_read",
    "1.0.0",
  ],
  "activity_feed:create": [
    "activity_feed:post:create",
    "school_write",
    "1.0.0",
  ],
  "activity_feed:read": ["activity_feed:post:read", "school_read", "1.0.0"],
  "activity_feed:moderate": [
    "activity_feed:post:moderate",
    "school_privileged",
    "1.0.0",
  ],
  "advanced:approvals:read": ["advanced:approvals:read", "authz_read", "1.0.0"],
  "advanced:approvals:manage": [
    "advanced:approvals:manage",
    "school_privileged",
    "1.0.0",
  ],
  "advanced:approvals:decide": [
    "advanced:approvals:decide",
    "school_privileged",
    "1.0.0",
  ],
  "advanced:automation:read": [
    "advanced:automation:read",
    "school_read",
    "1.0.0",
  ],
  "advanced:automation:manage": [
    "advanced:automation:manage",
    "school_privileged",
    "1.0.0",
  ],
  "advanced:automation:execute": [
    "advanced:automation:execute",
    "school_privileged",
    "1.0.0",
  ],
  "advanced:analytics:read": [
    "advanced:analytics:read",
    "report_read",
    "1.0.0",
  ],
  "advanced:analytics:refresh": [
    "advanced:analytics:refresh",
    "protected_export",
    "1.0.0",
  ],
  "advanced:documents:read": [
    "advanced:documents:read",
    "protected_export",
    "1.0.0",
  ],
  "advanced:documents:manage": [
    "advanced:documents:manage",
    "protected_export",
    "1.0.0",
  ],
  "advanced:exports:read": [
    "advanced:exports:read",
    "protected_export",
    "1.0.0",
  ],
  "advanced:exports:create": [
    "advanced:exports:create",
    "protected_export",
    "1.0.0",
  ],
  "attendance:mark": ["attendance:record:mark", "academic_write", "1.0.0"],
  "attendance:read": ["attendance:record:read", "academic_read", "1.0.0"],
  "attendance:review_conflicts": [
    "attendance:correction:review_conflicts",
    "academic_approval",
    "1.0.0",
  ],
  "attendance:manage_all": [
    "attendance:record:manage_all",
    "academic_write",
    "1.0.0",
  ],
  "attendance:override_lock": [
    "attendance:record:override_lock",
    "academic_approval",
    "1.0.0",
  ],
  "attendance:staff:update": [
    "attendance:staff:update",
    "staff_write",
    "1.0.0",
  ],
  "users:create": ["security:users:create", "authz_manage", "1.0.0"],
  "users:read": ["security:users:read", "authz_read", "1.0.0"],
  "users:update_status": [
    "security:users:update_status",
    "authz_manage",
    "1.0.0",
  ],
  "users:reset_password": [
    "security:users:reset_password",
    "authz_manage",
    "1.0.0",
  ],
  "roles:read": ["security:roles:read", "authz_read", "1.0.0"],
  "roles:create": ["security:roles:create", "authz_manage", "1.0.0"],
  "roles:assign": ["security:roles:assign", "authz_manage", "1.0.0"],
  "roles:manage_permissions": [
    "security:roles:manage_permissions",
    "authz_manage",
    "1.0.0",
  ],
  "canteen:menu:create": ["canteen:menu:create", "school_write", "1.0.0"],
  "canteen:menu:read": ["canteen:menu:read", "school_read", "1.0.0"],
  "canteen:menu:update": ["canteen:menu:update", "school_write", "1.0.0"],
  "canteen:plans:create": ["canteen:plans:create", "school_write", "1.0.0"],
  "canteen:plans:read": ["canteen:plans:read", "school_read", "1.0.0"],
  "canteen:plans:update": ["canteen:plans:update", "school_write", "1.0.0"],
  "canteen:enrollments:create": [
    "canteen:enrollments:create",
    "school_write",
    "1.0.0",
  ],
  "canteen:enrollments:read": [
    "canteen:enrollments:read",
    "school_read",
    "1.0.0",
  ],
  "canteen:enrollments:update": [
    "canteen:enrollments:update",
    "school_write",
    "1.0.0",
  ],
  "canteen:serving:create": ["canteen:serving:create", "school_write", "1.0.0"],
  "canteen:serving:read": ["canteen:serving:read", "school_read", "1.0.0"],
  "canteen:serving:update": ["canteen:serving:update", "school_write", "1.0.0"],
  "canteen:wallets:create": [
    "canteen:wallets:create",
    "finance_write",
    "1.0.0",
  ],
  "canteen:wallets:read": ["canteen:wallets:read", "school_read", "1.0.0"],
  "canteen:wallets:update": [
    "canteen:wallets:update",
    "finance_write",
    "1.0.0",
  ],
  "canteen:pos:create": ["canteen:pos:create", "finance_write", "1.0.0"],
  "canteen:pos:read": ["canteen:pos:read", "school_read", "1.0.0"],
  "canteen:pos:update": ["canteen:pos:update", "finance_write", "1.0.0"],
  "canteen:inventory:read": ["canteen:inventory:read", "school_read", "1.0.0"],
  "canteen:inventory:update": [
    "canteen:inventory:update",
    "finance_write",
    "1.0.0",
  ],
  "canteen:controls:create": [
    "canteen:controls:create",
    "finance_critical",
    "1.0.0",
  ],
  "canteen:controls:read": ["canteen:controls:read", "school_read", "1.0.0"],
  "canteen:controls:update": [
    "canteen:controls:update",
    "finance_critical",
    "1.0.0",
  ],
  "canteen:reports:read": ["canteen:reports:read", "school_read", "1.0.0"],
  "canteen:parent:read": ["canteen:parent:read", "self_service", "1.0.0"],
  "notifications:view_own": [
    "notifications:inbox:view_own",
    "self_service",
    "1.0.0",
  ],
  "notifications:manage_templates": [
    "notifications:template:manage",
    "school_privileged",
    "1.0.0",
  ],
  "notifications:manage_preferences": [
    "notifications:preference:manage",
    "self_service",
    "1.0.0",
  ],
  "notifications:view_delivery_diagnostics": [
    "notifications:delivery:read_diagnostics",
    "school_read",
    "1.0.0",
  ],
  "notifications:retry_deliveries": [
    "notifications:delivery:retry",
    "school_privileged",
    "1.0.0",
  ],
  "notices:create": ["notices:notice:create", "school_write", "1.0.0"],
  "notices:edit": ["notices:notice:edit", "school_write", "1.0.0"],
  "notices:publish": ["notices:notice:publish", "school_privileged", "1.0.0"],
  "notices:schedule": ["notices:notice:schedule", "school_write", "1.0.0"],
  "notices:cancel": ["notices:notice:cancel", "school_write", "1.0.0"],
  "notices:archive": ["notices:notice:archive", "school_write", "1.0.0"],
  "notices:read": ["notices:notice:read", "school_read", "1.0.0"],
  "notices:approve": ["notices:notice:approve", "school_privileged", "1.0.0"],
  "notices:send_emergency": [
    "notices:notice:send_emergency",
    "school_privileged",
    "1.0.0",
  ],
  "notices:read_reports": [
    "notices:report:read_reports",
    "school_read",
    "1.0.0",
  ],
  "events:create": ["notices:event:create", "school_write", "1.0.0"],
  "events:read": ["notices:event:read", "school_read", "1.0.0"],
  "communications:read_deliveries": [
    "communications:delivery:read_deliveries",
    "school_read",
    "1.0.0",
  ],
  "communications:retry_deliveries": [
    "communications:delivery:retry_deliveries",
    "school_privileged",
    "1.0.0",
  ],
  "communications:manage_templates": [
    "communications:template:manage",
    "school_write",
    "1.0.0",
  ],
  "communications:manage_consent": [
    "communications:consent:manage",
    "school_privileged",
    "1.0.0",
  ],
  "consents:manage": ["consents:record:manage", "school_privileged", "1.0.0"],
  "service_requests:create": [
    "service_requests:request:create",
    "school_write",
    "1.0.0",
  ],
  "service_requests:read": [
    "service_requests:request:read",
    "self_service",
    "1.0.0",
  ],
  "service_requests:manage": [
    "service_requests:request:manage",
    "school_write",
    "1.0.0",
  ],
  "fees:manage": ["fees:configuration:manage", "finance_critical", "1.0.0"],
  "fees:bill": ["fees:invoice:bill", "finance_write", "1.0.0"],
  "fees:discount": ["fees:discount:manage", "finance_critical", "1.0.0"],
  "fees:adjust": ["fees:invoice:adjust", "finance_critical", "1.0.0"],
  "payments:collect": ["fees:payment:collect", "finance_write", "1.0.0"],
  "payments:refund:request": [
    "payments:refund:request",
    "finance_write",
    "1.0.0",
  ],
  "payments:reverse:request": [
    "payments:reverse:request",
    "finance_write",
    "1.0.0",
  ],
  "finance:approvals:review": [
    "finance:approvals:review",
    "finance_write",
    "1.0.0",
  ],
  "payments:refund": ["fees:payment:refund", "finance_critical", "1.0.0"],
  "payments:close": ["fees:payment:close", "finance_critical", "1.0.0"],
  "payments:reverse": ["fees:payment:reverse", "finance_critical", "1.0.0"],
  "receipts:read": ["fees:receipt:read", "finance_read", "1.0.0"],
  "receipts:manage": ["fees:receipt:manage", "finance_critical", "1.0.0"],
  "ledger:read": ["accounting:ledger:read", "finance_read", "1.0.0"],
  "hr:manage": ["hr:workspace:manage", "staff_write", "1.0.0"],
  "hr:read": ["hr:workspace:read", "staff_read", "1.0.0"],
  "hr:documents:read": ["hr:documents:read", "staff_read", "1.0.0"],
  "hr:documents:manage": ["hr:documents:manage", "staff_write", "1.0.0"],
  "hr:identity:read": ["hr:identity:read", "staff_read", "1.0.0"],
  "hr:identity:write": ["hr:identity:write", "staff_write", "1.0.0"],
  "hr:bank:read": ["hr:bank:read", "staff_read", "1.0.0"],
  "hr:bank:write": ["hr:bank:write", "staff_write", "1.0.0"],
  "hr:tax:read": ["hr:tax:read", "staff_read", "1.0.0"],
  "hr:tax:write": ["hr:tax:write", "staff_write", "1.0.0"],
  "hr:disciplinary:read": ["hr:disciplinary:read", "staff_read", "1.0.0"],
  "hr:disciplinary:manage": ["hr:disciplinary:manage", "staff_write", "1.0.0"],
  "hr:medical:read": ["hr:medical:read", "staff_restricted_read", "1.0.0"],
  "hr:medical:manage": [
    "hr:medical:manage",
    "staff_restricted_manage",
    "1.0.0",
  ],
  "hr:safeguarding:read": [
    "hr:safeguarding:read",
    "staff_restricted_read",
    "1.0.0",
  ],
  "hr:safeguarding:manage": [
    "hr:safeguarding:manage",
    "staff_restricted_manage",
    "1.0.0",
  ],
  "hr:staff:read": ["hr:staff:read", "staff_read", "1.0.0"],
  "hr:staff:create": ["hr:staff:create", "staff_write", "1.0.0"],
  "hr:staff:update": ["hr:staff:update", "staff_write", "1.0.0"],
  "hr:staff:lifecycle": ["hr:staff:lifecycle", "staff_lifecycle", "1.0.0"],
  "hr:staff:terminate": ["hr:staff:terminate", "staff_lifecycle", "1.0.0"],
  "hr:staff:archive": ["hr:staff:archive", "staff_lifecycle", "1.0.0"],
  "hr:attendance:read": ["hr:attendance:read", "staff_read", "1.0.0"],
  "hr:attendance:write": ["hr:attendance:write", "staff_write", "1.0.0"],
  "hr:attendance-corrections:approve": [
    "hr:attendance-corrections:approve",
    "staff_approval",
    "1.0.0",
  ],
  "hr:attendance:correct": ["hr:attendance:correct", "staff_write", "1.0.0"],
  "hr:leave:read": ["hr:leave:read", "staff_read", "1.0.0"],
  "hr:leave:request": ["hr:leave:request", "staff_read", "1.0.0"],
  "hr:leave:approve": ["hr:leave:approve", "staff_approval", "1.0.0"],
  "hr:leave:adjust": ["hr:leave:adjust", "staff_write", "1.0.0"],
  "learning:read": ["learning:activity:read", "school_read", "1.0.0"],
  "learning:manage": ["learning:activity:manage", "school_write", "1.0.0"],
  "learning:create": ["learning:activity:create", "school_write", "1.0.0"],
  "learning:update": ["learning:activity:update", "school_write", "1.0.0"],
  "learning:delete": ["learning:activity:delete", "school_write", "1.0.0"],
  "learning:launch": ["learning:activity:launch", "school_write", "1.0.0"],
  "learning:attempt": ["learning:activity:attempt", "self_service", "1.0.0"],
  "learning:progress": ["learning:activity:progress", "self_service", "1.0.0"],
  "library:read": ["library:workspace:read", "school_read", "1.0.0"],
  "library:manage": ["library:workspace:manage", "school_write", "1.0.0"],
  "library:books:create": ["library:books:create", "school_write", "1.0.0"],
  "library:books:read": ["library:books:read", "school_read", "1.0.0"],
  "library:books:update": ["library:books:update", "school_write", "1.0.0"],
  "library:copies:create": ["library:copies:create", "school_write", "1.0.0"],
  "library:copies:read": ["library:copies:read", "school_read", "1.0.0"],
  "library:copies:update": ["library:copies:update", "school_write", "1.0.0"],
  "library:issues:create": ["library:issues:create", "school_write", "1.0.0"],
  "library:issues:read": ["library:issues:read", "school_read", "1.0.0"],
  "library:issues:return": ["library:issues:return", "school_write", "1.0.0"],
  "library:fines:create": ["library:fines:create", "finance_write", "1.0.0"],
  "library:fines:update": ["library:fines:update", "finance_write", "1.0.0"],
  "library:fines:post": ["library:fines:post", "finance_write", "1.0.0"],
  "library:reports:read": ["library:reports:read", "school_read", "1.0.0"],
  "library:reports:export": [
    "library:reports:export",
    "protected_export",
    "1.0.0",
  ],
  "messaging:create": ["messaging:thread:create", "legacy_disabled", "1.0.0"],
  "messaging:read": ["messaging:thread:read", "school_read", "1.0.0"],
  "messaging:manage": ["messaging:thread:manage", "legacy_disabled", "1.0.0"],
  "payroll:manage": ["payroll:workspace:manage", "finance_critical", "1.0.0"],
  "payroll:read": ["payroll:workspace:read", "finance_read", "1.0.0"],
  "payroll:salary:read": ["payroll:salary:read", "finance_read", "1.0.0"],
  "payroll:salary:write": ["payroll:salary:write", "finance_write", "1.0.0"],
  "payroll:run:create": ["payroll:run:create", "finance_write", "1.0.0"],
  "payroll:run:read": ["payroll:run:read", "finance_read", "1.0.0"],
  "payroll:run:review": ["payroll:run:review", "finance_write", "1.0.0"],
  "payroll:run:validate": ["payroll:run:validate", "finance_write", "1.0.0"],
  "payroll:run:finalize": ["payroll:run:finalize", "finance_critical", "1.0.0"],
  "payroll:run:approve": ["payroll:run:approve", "finance_approval", "1.0.0"],
  "payroll:run:post": ["payroll:run:post", "finance_critical", "1.0.0"],
  "payroll:run:pay": ["payroll:run:pay", "finance_critical", "1.0.0"],
  "payroll:run:reverse": ["payroll:run:reverse", "finance_critical", "1.0.0"],
  "payroll:payslip:read": ["payroll:payslip:read", "staff_read", "1.0.0"],
  "payroll:payslip:generate": [
    "payroll:payslip:generate",
    "finance_write",
    "1.0.0",
  ],
  "payroll:reports:read": ["payroll:reports:read", "finance_read", "1.0.0"],
  "payroll:exports:create": [
    "payroll:exports:create",
    "protected_export",
    "1.0.0",
  ],
  "payroll:hold:create": ["payroll:hold:create", "finance_write", "1.0.0"],
  "payroll:hold:release": ["payroll:hold:release", "finance_critical", "1.0.0"],
  "payroll:bank-advice:export": [
    "payroll:bank-advice:export",
    "protected_export",
    "1.0.0",
  ],
  "tenants:manage": ["platform:tenants:manage", "platform_manage", "1.0.0"],
  "tenants:read": ["settings:tenant_profile:read", "school_read", "1.0.0"],
  "platform:read": ["platform:control_plane:read", "platform_read", "1.0.0"],
  "platform:manage": [
    "platform:control_plane:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:dashboard:read": [
    "platform:dashboard:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:tenants:read": ["platform:tenants:read", "platform_read", "1.0.0"],
  "platform:tenants:status": [
    "platform:tenants:status",
    "platform_manage",
    "1.0.0",
  ],
  "platform:plans:read": ["platform:plans:read", "platform_read", "1.0.0"],
  "platform:plans:manage": [
    "platform:plans:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:subscriptions:read": [
    "platform:subscriptions:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:subscriptions:manage": [
    "platform:subscriptions:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:usage:read": ["platform:usage:read", "platform_read", "1.0.0"],
  "platform:billing:read": ["platform:billing:read", "platform_read", "1.0.0"],
  "platform:billing:manage": [
    "platform:billing:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:providers:read": [
    "platform:providers:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:providers:manage": [
    "platform:providers:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:api-keys:read": [
    "platform:api-keys:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:api-keys:manage": [
    "platform:api-keys:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:queues:read": ["platform:queues:read", "platform_read", "1.0.0"],
  "platform:queues:retry": [
    "platform:queues:retry",
    "platform_manage",
    "1.0.0",
  ],
  "platform:queues:manage": [
    "platform:queues:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:support:override": [
    "platform:support:override",
    "platform_manage",
    "1.0.0",
  ],
  "platform:audit:read": ["platform:audit:read", "platform_read", "1.0.0"],
  "platform:health:read": ["platform:health:read", "platform_read", "1.0.0"],
  "platform:reports:read": ["platform:reports:read", "platform_read", "1.0.0"],
  "platform:onboarding:read": [
    "platform:onboarding:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:onboarding:manage": [
    "platform:onboarding:manage",
    "platform_manage",
    "1.0.0",
  ],
  "platform:demo-requests:read": [
    "platform:demo-requests:read",
    "platform_read",
    "1.0.0",
  ],
  "platform:demo-requests:manage": [
    "platform:demo-requests:manage",
    "platform_manage",
    "1.0.0",
  ],
  "settings:read_public": [
    "settings:tenant:read_public",
    "school_read",
    "1.0.0",
  ],
  "settings:read": ["settings:tenant:read", "school_read", "1.0.0"],
  "settings:manage": ["settings:tenant:manage", "authz_manage", "1.0.0"],
  "settings:delegate": ["settings:tenant:delegate", "authz_manage", "1.0.0"],
  "settings:audit:read": ["settings:audit:read", "authz_read", "1.0.0"],
  "settings:identity:manage": [
    "settings:identity:manage",
    "school_privileged",
    "1.0.0",
  ],
  "settings:academic:manage": [
    "settings:academic:manage",
    "school_privileged",
    "1.0.0",
  ],
  "settings:attendance:manage": [
    "settings:attendance:manage",
    "school_privileged",
    "1.0.0",
  ],
  "settings:finance:manage": [
    "settings:finance:manage",
    "finance_critical",
    "1.0.0",
  ],
  "settings:hr:manage": ["settings:hr:manage", "school_privileged", "1.0.0"],
  "settings:accounting:manage": [
    "settings:accounting:manage",
    "finance_critical",
    "1.0.0",
  ],
  "settings:communication:manage": [
    "settings:communication:manage",
    "school_privileged",
    "1.0.0",
  ],
  "settings:security:manage": [
    "settings:security:manage",
    "authz_manage",
    "1.0.0",
  ],
  "reports:read": ["reports:report:read", "report_read", "1.0.0"],
  "reports:export": ["reports:report:export", "protected_export", "1.0.0"],
  "staff:create": ["staff:directory:create", "staff_write", "1.0.0"],
  "staff:read": ["staff:directory:read", "staff_read", "1.0.0"],
  "staff:update": ["staff:directory:update", "staff_write", "1.0.0"],
  "students:create": ["students:profile:create", "student_write", "1.0.0"],
  "students:read": ["students:profile:read", "student_read", "1.0.0"],
  "students:update": ["students:profile:update", "student_write", "1.0.0"],
  "students:delete": [
    "students:profile:delete",
    "student_sensitive_write",
    "1.0.0",
  ],
  "students:manage_lifecycle": [
    "students:profile:manage_lifecycle",
    "student_sensitive_write",
    "1.0.0",
  ],
  "admission_policy:read": ["admissions:policy:read", "student_read", "1.0.0"],
  "admission_policy:manage": [
    "admissions:policy:manage",
    "student_write",
    "1.0.0",
  ],
  "students:qr:generate": ["students:qr:generate", "student_write", "1.0.0"],
  "students:qr:read": ["students:qr:read", "student_read", "1.0.0"],
  "students:qr:rotate": [
    "students:qr:rotate",
    "student_sensitive_write",
    "1.0.0",
  ],
  "students:qr:revoke": [
    "students:qr:revoke",
    "student_sensitive_write",
    "1.0.0",
  ],
  "students:qr:resolve": ["students:qr:resolve", "student_write", "1.0.0"],
  "students:qr:resolve_all": [
    "students:qr:resolve_all",
    "student_write",
    "1.0.0",
  ],
  "guardians:create": ["students:guardian:create", "student_write", "1.0.0"],
  "guardians:read": ["students:guardian:read", "student_read", "1.0.0"],
  "guardians:update": ["students:guardian:update", "student_write", "1.0.0"],
  "guardians:verify": [
    "students:guardian:verify",
    "student_sensitive_write",
    "1.0.0",
  ],
  "student_documents:manage": [
    "students:document:manage",
    "student_write",
    "1.0.0",
  ],
  "siblings:manage": ["students:sibling:manage", "student_write", "1.0.0"],
  "enrollments:create": [
    "admissions:enrollment:create",
    "student_write",
    "1.0.0",
  ],
  "enrollments:read": ["admissions:enrollment:read", "student_read", "1.0.0"],
  "transport:read": ["transport:workspace:read", "school_read", "1.0.0"],
  "transport:manage": ["transport:workspace:manage", "school_write", "1.0.0"],
  "transport:operate": ["transport:workspace:operate", "school_write", "1.0.0"],
  "transport:routes:create": [
    "transport:routes:create",
    "school_write",
    "1.0.0",
  ],
  "transport:routes:read": ["transport:routes:read", "school_read", "1.0.0"],
  "transport:routes:update": [
    "transport:routes:update",
    "school_write",
    "1.0.0",
  ],
  "transport:vehicles:create": [
    "transport:vehicles:create",
    "school_write",
    "1.0.0",
  ],
  "transport:vehicles:read": [
    "transport:vehicles:read",
    "school_read",
    "1.0.0",
  ],
  "transport:vehicles:update": [
    "transport:vehicles:update",
    "school_write",
    "1.0.0",
  ],
  "transport:assignments:create": [
    "transport:assignments:create",
    "school_write",
    "1.0.0",
  ],
  "transport:assignments:read": [
    "transport:assignments:read",
    "school_read",
    "1.0.0",
  ],
  "transport:assignments:update": [
    "transport:assignments:update",
    "school_write",
    "1.0.0",
  ],
  "transport:trips:create": ["transport:trips:create", "school_write", "1.0.0"],
  "transport:trips:read": ["transport:trips:read", "school_read", "1.0.0"],
  "transport:trips:update": ["transport:trips:update", "school_write", "1.0.0"],
  "transport:location:read": [
    "transport:location:read",
    "school_read",
    "1.0.0",
  ],
  "transport:location:update": [
    "transport:location:update",
    "school_privileged",
    "1.0.0",
  ],
  "transport:tracking:parent": [
    "transport:tracking:parent",
    "self_service",
    "1.0.0",
  ],
  "transport:reports:read": ["transport:reports:read", "school_read", "1.0.0"],
} as const satisfies Record<LegacyCatalogPermissionKey, MetadataRow>;

export type CanonicalPermissionCode =
  (typeof legacyPermissionMetadata)[LegacyCatalogPermissionKey][0];

export type CanonicalPermissionDefinition = Readonly<{
  code: CanonicalPermissionCode;
  module: string;
  resource: string;
  action: string;
  legacyKey: LegacyCatalogPermissionKey;
  riskLevel: CanonicalPermissionRiskLevel;
  allowedScopeTypes: readonly CanonicalPermissionScopeType[];
  delegable: boolean;
  requiresReason: boolean;
  requiresMfa: boolean;
  requiresApproval: boolean;
  description: string;
  introducedVersion: string;
  deprecatedAt: string | null;
}>;

function compileCanonicalDefinitions(): readonly CanonicalPermissionDefinition[] {
  const descriptions = new Map<string, string>();
  for (const { resource, action, description } of permissionCatalog) {
    const key = `${resource}:${action}`;
    if (descriptions.has(key)) {
      throw new Error(`Duplicate legacy permission key: ${key}`);
    }
    descriptions.set(key, description);
  }

  const mappings = Object.entries(legacyPermissionMetadata) as Array<
    [LegacyCatalogPermissionKey, MetadataRow]
  >;
  if (mappings.length !== descriptions.size) {
    throw new Error(
      "Canonical permission mapping does not cover the legacy catalog",
    );
  }

  const codes = new Set<string>();
  const definitions = mappings.map(([legacyKey, row]) => {
    const [code, profileName, introducedVersion, deprecatedAt = null] = row;
    const description = descriptions.get(legacyKey);
    if (!description?.trim()) {
      throw new Error(`Unknown or undescribed legacy permission: ${legacyKey}`);
    }
    const segments = code.split(":");
    if (
      segments.length !== 3 ||
      segments.some((segment) => !/^[a-z][a-z0-9_-]*$/.test(segment))
    ) {
      throw new Error(`Invalid canonical permission code: ${code}`);
    }
    if (codes.has(code)) {
      throw new Error(`Duplicate canonical permission code: ${code}`);
    }
    codes.add(code);

    const isPlatformLegacy =
      legacyKey.startsWith("platform:") || legacyKey === "tenants:manage";
    if (isPlatformLegacy !== (segments[0] === "platform")) {
      throw new Error(
        `Security-domain mismatch in permission mapping: ${legacyKey}`,
      );
    }
    const profile = metadataProfiles[profileName];
    if (!profile || !introducedVersion.trim()) {
      throw new Error(`Incomplete canonical metadata for ${legacyKey}`);
    }
    const allowedScopeTypes: readonly CanonicalPermissionScopeType[] =
      profile.allowedScopeTypes;
    if (
      (isPlatformLegacy &&
        (allowedScopeTypes.length !== 1 ||
          allowedScopeTypes[0] !== "GLOBAL")) ||
      (!isPlatformLegacy && allowedScopeTypes.includes("GLOBAL"))
    ) {
      throw new Error(`Invalid security-domain scope for ${legacyKey}`);
    }

    return Object.freeze({
      code,
      module: segments[0],
      resource: segments[1],
      action: segments[2],
      legacyKey,
      ...profile,
      allowedScopeTypes: Object.freeze([...profile.allowedScopeTypes]),
      description,
      introducedVersion,
      deprecatedAt,
    }) as CanonicalPermissionDefinition;
  });
  return Object.freeze(definitions);
}

export const canonicalPermissionCatalog = compileCanonicalDefinitions();

const canonicalByLegacyKey = new Map(
  canonicalPermissionCatalog.map((definition) => [
    definition.legacyKey,
    definition,
  ]),
);
const canonicalByCode = new Map(
  canonicalPermissionCatalog.map((definition) => [definition.code, definition]),
);

/** Unknown permissions have no definition and must be denied by callers. */
export function getCanonicalPermissionForLegacyKey(
  legacyKey: string,
): CanonicalPermissionDefinition | null {
  return (
    canonicalByLegacyKey.get(legacyKey as LegacyCatalogPermissionKey) ?? null
  );
}

export function getCanonicalPermissionByCode(
  code: string,
): CanonicalPermissionDefinition | null {
  return canonicalByCode.get(code as CanonicalPermissionCode) ?? null;
}
