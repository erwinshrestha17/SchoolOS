export declare const permissionCatalog: readonly [{
    readonly resource: "users";
    readonly action: "create";
    readonly description: "Create users inside a tenant";
}, {
    readonly resource: "users";
    readonly action: "read";
    readonly description: "Read users inside a tenant";
}, {
    readonly resource: "users";
    readonly action: "update_status";
    readonly description: "Suspend or activate users inside a tenant";
}, {
    readonly resource: "users";
    readonly action: "reset_password";
    readonly description: "Reset user passwords and revoke active sessions";
}, {
    readonly resource: "roles";
    readonly action: "read";
    readonly description: "Read roles and permission catalog";
}, {
    readonly resource: "roles";
    readonly action: "create";
    readonly description: "Create custom roles inside a tenant";
}, {
    readonly resource: "roles";
    readonly action: "assign";
    readonly description: "Assign roles to tenant users";
}, {
    readonly resource: "roles";
    readonly action: "manage_permissions";
    readonly description: "Attach permissions to roles";
}, {
    readonly resource: "classes";
    readonly action: "create";
    readonly description: "Create classes inside a tenant";
}, {
    readonly resource: "classes";
    readonly action: "read";
    readonly description: "Read classes inside a tenant";
}, {
    readonly resource: "academic_years";
    readonly action: "create";
    readonly description: "Create academic years inside a tenant";
}, {
    readonly resource: "academic_years";
    readonly action: "read";
    readonly description: "Read academic years inside a tenant";
}, {
    readonly resource: "sections";
    readonly action: "create";
    readonly description: "Create sections inside a tenant";
}, {
    readonly resource: "sections";
    readonly action: "read";
    readonly description: "Read sections inside a tenant";
}, {
    readonly resource: "students";
    readonly action: "create";
    readonly description: "Create student records inside a tenant";
}, {
    readonly resource: "students";
    readonly action: "read";
    readonly description: "Read student records inside a tenant";
}, {
    readonly resource: "students";
    readonly action: "update";
    readonly description: "Update mutable student profile fields inside a tenant";
}, {
    readonly resource: "students";
    readonly action: "delete";
    readonly description: "Delete or withdraw student records";
}, {
    readonly resource: "students";
    readonly action: "manage_lifecycle";
    readonly description: "Transfer, exit, archive, and manage student lifecycle transitions";
}, {
    readonly resource: "tenants";
    readonly action: "manage";
    readonly description: "Deactivate or manage tenants (super_admin only)";
}, {
    readonly resource: "guardians";
    readonly action: "create";
    readonly description: "Create guardian records inside a tenant";
}, {
    readonly resource: "guardians";
    readonly action: "read";
    readonly description: "Read guardian records inside a tenant";
}, {
    readonly resource: "guardians";
    readonly action: "update";
    readonly description: "Update linked guardian records inside a tenant";
}, {
    readonly resource: "guardians";
    readonly action: "verify";
    readonly description: "Review and approve guardian identity verification records";
}, {
    readonly resource: "student_documents";
    readonly action: "manage";
    readonly description: "Upload and manage student documents inside a tenant";
}, {
    readonly resource: "siblings";
    readonly action: "manage";
    readonly description: "Manage sibling groups for fee discounts and family views";
}, {
    readonly resource: "enrollments";
    readonly action: "create";
    readonly description: "Create student enrollment records and side effects";
}, {
    readonly resource: "enrollments";
    readonly action: "read";
    readonly description: "Read student enrollment history";
}, {
    readonly resource: "staff";
    readonly action: "create";
    readonly description: "Create staff accounts and profiles inside a tenant";
}, {
    readonly resource: "staff";
    readonly action: "read";
    readonly description: "Read staff accounts and profiles inside a tenant";
}, {
    readonly resource: "academics";
    readonly action: "manage";
    readonly description: "Manage subjects, exams, CAS, marks, and report cards";
}, {
    readonly resource: "academics";
    readonly action: "read";
    readonly description: "Read academic setup, marks, CAS, and report cards";
}, {
    readonly resource: "academics";
    readonly action: "enter_marks";
    readonly description: "Enter and update academic marks and CAS records";
}, {
    readonly resource: "academics";
    readonly action: "manage_report_cards";
    readonly description: "Generate, lock, and publish academic report cards";
}, {
    readonly resource: "timetable";
    readonly action: "manage";
    readonly description: "Create timetable slots and teacher workload schedules";
}, {
    readonly resource: "timetable";
    readonly action: "read";
    readonly description: "Read timetable slots and teacher workload schedules";
}, {
    readonly resource: "homework";
    readonly action: "create";
    readonly description: "Publish homework assignments to class and student audiences";
}, {
    readonly resource: "homework";
    readonly action: "read";
    readonly description: "Read homework assignments and submissions";
}, {
    readonly resource: "homework";
    readonly action: "review";
    readonly description: "Review homework submissions and scores";
}, {
    readonly resource: "hr";
    readonly action: "manage";
    readonly description: "Manage HR contracts and staff employment records";
}, {
    readonly resource: "hr";
    readonly action: "read";
    readonly description: "Read HR contracts and staff employment records";
}, {
    readonly resource: "payroll";
    readonly action: "manage";
    readonly description: "Run, approve, and post payroll";
}, {
    readonly resource: "payroll";
    readonly action: "read";
    readonly description: "Read payroll runs and payslips";
}, {
    readonly resource: "attendance";
    readonly action: "mark";
    readonly description: "Submit and lock attendance sessions";
}, {
    readonly resource: "attendance";
    readonly action: "read";
    readonly description: "Read attendance sessions and analytics";
}, {
    readonly resource: "attendance";
    readonly action: "review_conflicts";
    readonly description: "Review conflicting attendance submissions";
}, {
    readonly resource: "fees";
    readonly action: "manage";
    readonly description: "Manage fee heads, plans, and student assignments";
}, {
    readonly resource: "fees";
    readonly action: "bill";
    readonly description: "Generate recurring fee invoices and billing runs";
}, {
    readonly resource: "fees";
    readonly action: "discount";
    readonly description: "Manage discounts and waivers";
}, {
    readonly resource: "fees";
    readonly action: "adjust";
    readonly description: "Void invoices and post audited fee invoice adjustments";
}, {
    readonly resource: "payments";
    readonly action: "collect";
    readonly description: "Collect payments and issue receipts";
}, {
    readonly resource: "payments";
    readonly action: "refund";
    readonly description: "Refund collected payments with immutable journal posting";
}, {
    readonly resource: "payments";
    readonly action: "close";
    readonly description: "Preview and finalize cashier close snapshots";
}, {
    readonly resource: "receipts";
    readonly action: "read";
    readonly description: "Read payment receipts and receipt PDFs";
}, {
    readonly resource: "ledger";
    readonly action: "read";
    readonly description: "Read ledger entries and journal lines";
}, {
    readonly resource: "accounting";
    readonly action: "read";
    readonly description: "Read accounting periods and financial reports";
}, {
    readonly resource: "accounting";
    readonly action: "close";
    readonly description: "Close accounting periods with audit visibility";
}, {
    readonly resource: "accounting";
    readonly action: "reverse";
    readonly description: "Create reversing journal entries for posted accounting records";
}, {
    readonly resource: "activity_feed";
    readonly action: "create";
    readonly description: "Create classroom activity feed posts and mood logs";
}, {
    readonly resource: "activity_feed";
    readonly action: "read";
    readonly description: "Read activity feed posts and mood logs";
}, {
    readonly resource: "notices";
    readonly action: "create";
    readonly description: "Create and publish school notices";
}, {
    readonly resource: "notices";
    readonly action: "read";
    readonly description: "Read school notices";
}, {
    readonly resource: "events";
    readonly action: "create";
    readonly description: "Create school events";
}, {
    readonly resource: "events";
    readonly action: "read";
    readonly description: "Read school events";
}, {
    readonly resource: "communications";
    readonly action: "read_deliveries";
    readonly description: "Read notification delivery records";
}, {
    readonly resource: "messaging";
    readonly action: "create";
    readonly description: "Create parent-teacher conversations and messages";
}, {
    readonly resource: "messaging";
    readonly action: "read";
    readonly description: "Read parent-teacher conversations and message status";
}, {
    readonly resource: "library";
    readonly action: "read";
    readonly description: "Read library catalog, circulation, and overdue records";
}, {
    readonly resource: "library";
    readonly action: "manage";
    readonly description: "Manage books, copies, issue/return, fines, and lost items";
}, {
    readonly resource: "transport";
    readonly action: "read";
    readonly description: "Read routes, vehicles, enrollments, and transport logs";
}, {
    readonly resource: "transport";
    readonly action: "manage";
    readonly description: "Manage transport setup, enrollments, boarding, and delays";
}, {
    readonly resource: "transport";
    readonly action: "operate";
    readonly description: "Record assigned route logs and transport delay updates";
}, {
    readonly resource: "consents";
    readonly action: "manage";
    readonly description: "Capture and revoke guardian consent records";
}, {
    readonly resource: "tenants";
    readonly action: "read";
    readonly description: "Read the current tenant profile";
}, {
    readonly resource: "platform";
    readonly action: "read";
    readonly description: "Read platform global data (platform admins only)";
}, {
    readonly resource: "platform";
    readonly action: "manage";
    readonly description: "Manage platform, tenants, and global settings";
}, {
    readonly resource: "settings";
    readonly action: "read_public";
    readonly description: "Read public-safe tenant branding and localization settings";
}, {
    readonly resource: "settings";
    readonly action: "read";
    readonly description: "Read tenant settings and preferences";
}, {
    readonly resource: "settings";
    readonly action: "manage";
    readonly description: "Manage tenant branding, localization, and operational settings";
}];
export type PermissionResource = (typeof permissionCatalog)[number]["resource"];
export type PermissionAction = (typeof permissionCatalog)[number]["action"];
export type PermissionKey = `${(typeof permissionCatalog)[number]["resource"]}:${(typeof permissionCatalog)[number]["action"]}`;
export declare const systemRoleDefinitions: readonly [{
    readonly name: "super_admin";
    readonly description: "System preset role with every SchoolOS permission";
}, {
    readonly name: "platform_super_admin";
    readonly description: "Global platform role with full access to all tenants and settings";
}, {
    readonly name: "platform_support";
    readonly description: "Global platform role for support access and tenant viewing";
}, {
    readonly name: "platform_billing_admin";
    readonly description: "Global platform role for managing SaaS billing and plans";
}, {
    readonly name: "admin";
    readonly description: "System preset role for admin";
}, {
    readonly name: "teacher";
    readonly description: "System preset role for teacher";
}, {
    readonly name: "principal";
    readonly description: "System preset role for school principal";
}, {
    readonly name: "subject_teacher";
    readonly description: "System preset role for subject teachers";
}, {
    readonly name: "support_staff";
    readonly description: "System preset role for non-teaching support staff";
}, {
    readonly name: "student";
    readonly description: "System preset role for student";
}, {
    readonly name: "parent";
    readonly description: "System preset role for parent";
}, {
    readonly name: "accountant";
    readonly description: "System preset role for accountant";
}, {
    readonly name: "librarian";
    readonly description: "System preset role for librarian";
}, {
    readonly name: "driver";
    readonly description: "System preset role for driver";
}];
export declare function buildPermissionKey(resource: string, action: string): string;
export declare const systemRolePermissions: Record<string, string[]>;
