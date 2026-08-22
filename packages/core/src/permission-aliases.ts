/**
 * Permission aliases: broader grants that satisfy a narrower required
 * permission.
 *
 * This map is the authorization authority's own table -- it lives here rather
 * than inside the Nest guard so the web can ask the *same* question the
 * backend will answer. Without it the two drift: the guard aliases
 * `notifications:view_own` to `notices:read`, but a frontend checking the raw
 * key concluded a teacher had no access and rendered a permission-denied page
 * over an endpoint the backend would have served (P1.13).
 *
 * Frontend use is UX only. The backend guard remains the decision-maker; this
 * exists so the UI stops disagreeing with it.
 */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  "notifications:view_own": ["notices:read"],
  "notifications:manage_templates": ["communications:manage_templates"],
  // Gates only the self-scoped GET/PATCH .../communications/preferences and
  // marketing opt-in/out routes, which resolve strictly to the caller's own
  // linked guardian record (see M10HardeningService.getGuardianForActor) —
  // safe to satisfy with the near-universal notices:read grant. Guardian
  // consent capture/revoke for OTHER people and consent-template management
  // are gated separately by consents:manage / communications:manage_consent.
  "notifications:manage_preferences": ["notices:read"],
  "notifications:view_delivery_diagnostics": ["communications:read_deliveries"],
  "notifications:retry_deliveries": ["communications:retry_deliveries"],
  "notices:read_reports": ["communications:read_deliveries"],
  "academics:create": ["academics:manage"],
  "academics:update": ["academics:manage"],
  "academics:delete": ["academics:manage"],
  "marks:review_lock": ["academics:manage", "academics:update"],
  "results:publish": ["academics:manage_report_cards", "academics:manage"],
  "results:unpublish": ["academics:manage_report_cards", "academics:manage"],
  "academics:report_cards:review": [
    "academics:manage_report_cards",
    "academics:manage",
  ],
  "exam-terms:unlock": ["exam-terms:manage", "academics:manage"],
  "cas-records:read": ["academics:read"],
  "cas-records:manage": ["academics:manage"],
  "timetable:read_published": ["timetable:read"],
  "homework:read_published": ["homework:read"],
  "hr:staff:read": ["staff:read", "hr:read"],
  "hr:staff:create": ["staff:create", "hr:manage"],
  "hr:staff:update": ["hr:manage"],
  "hr:staff:lifecycle": ["hr:manage"],
  "hr:attendance:read": ["attendance:read", "hr:read"],
  "hr:attendance:write": ["attendance:mark", "hr:manage"],
  "hr:attendance:correct": ["attendance:review_conflicts", "hr:manage"],
  "hr:leave:read": ["hr:read"],
  "hr:leave:request": ["staff:read", "hr:manage"],
  "hr:leave:approve": ["hr:manage"],
  "hr:leave:adjust": ["hr:manage"],
  "payroll:salary:read": ["payroll:read"],
  "payroll:salary:write": ["payroll:manage"],
  "payroll:run:create": ["payroll:manage"],
  "payroll:run:read": ["payroll:read"],
  "payroll:run:review": ["payroll:manage"],
  "payroll:run:approve": ["payroll:manage"],
  "payroll:run:post": ["payroll:manage"],
  "payroll:run:pay": ["payroll:manage"],
  "payroll:payslip:read": ["payroll:read", "staff:read"],
  "payroll:payslip:generate": ["payroll:manage"],
  "payroll:reports:read": ["payroll:read"],
  "payroll:exports:create": ["payroll:manage", "reports:export"],
  "accounting:accounts:read": ["accounting:read"],
  "accounting:journals:read": ["accounting:read", "ledger:read"],
  "accounting:journals:reverse": ["accounting:reverse"],
  "accounting:reports:read": ["accounting:read"],
  "accounting:exports:create": ["reports:export"],
  "library:books:create": ["library:manage"],
  "library:books:read": ["library:read"],
  "library:books:update": ["library:manage"],
  "library:copies:create": ["library:manage"],
  "library:copies:read": ["library:read"],
  "library:copies:update": ["library:manage"],
  "library:issues:create": ["library:manage"],
  "library:issues:read": ["library:read"],
  "library:issues:return": ["library:manage"],
  "library:fines:create": ["library:manage"],
  "library:fines:update": ["library:manage"],
  "library:fines:post": ["library:manage"],
  "library:reports:read": ["library:read"],
  "learning:create": ["learning:manage"],
  "learning:update": ["learning:manage"],
  "learning:delete": ["learning:manage"],
  "learning:launch": ["learning:manage"],
  "learning:progress": ["learning:read", "learning:manage"],
  "transport:routes:create": ["transport:manage"],
  "transport:routes:read": ["transport:read"],
  "transport:routes:update": ["transport:manage"],
  "transport:vehicles:create": ["transport:manage"],
  "transport:vehicles:read": ["transport:read"],
  "transport:vehicles:update": ["transport:manage"],
  "transport:assignments:create": ["transport:manage"],
  "transport:assignments:read": ["transport:read"],
  "transport:assignments:update": ["transport:manage"],
  "transport:trips:create": ["transport:operate", "transport:manage"],
  "transport:trips:read": ["transport:read", "transport:operate"],
  "transport:trips:update": ["transport:operate", "transport:manage"],
  "transport:location:read": ["transport:read", "transport:operate"],
  "transport:location:update": ["transport:operate", "transport:manage"],
  "transport:tracking:parent": ["transport:read"],
  "transport:reports:read": ["transport:read"],
  "settings:identity:manage": ["settings:manage"],
  "settings:academic:manage": ["settings:manage"],
  "settings:attendance:manage": ["settings:manage"],
  "settings:finance:manage": ["settings:manage"],
  "settings:hr:manage": ["settings:manage"],
  "settings:accounting:manage": ["settings:manage"],
  "settings:communication:manage": ["settings:manage"],
  "settings:security:manage": ["settings:manage"],
  "settings:audit:read": ["settings:manage"],
  "advanced:approvals:read": ["settings:read"],
  "advanced:approvals:manage": ["settings:manage"],
  "advanced:approvals:decide": ["settings:manage"],
  "advanced:automation:read": ["settings:read"],
  "advanced:automation:manage": ["settings:manage"],
  "advanced:automation:execute": ["settings:manage"],
  "advanced:analytics:read": ["reports:read"],
  "advanced:analytics:refresh": ["reports:export", "settings:manage"],
  "advanced:documents:read": ["reports:read"],
  "advanced:documents:manage": ["reports:export", "settings:manage"],
  "advanced:exports:read": ["reports:read"],
  "advanced:exports:create": ["reports:export"],
};

/**
 * Whether `granted` satisfies `required`, honouring aliases. Same rule the
 * backend guard applies.
 */
export function hasEffectivePermission(
  granted: readonly string[],
  required: string,
): boolean {
  if (granted.includes(required)) return true;
  return (PERMISSION_ALIASES[required] ?? []).some((alias) =>
    granted.includes(alias),
  );
}

/** ANY-match variant. Empty `required` means "no permission needed". */
export function hasAnyEffectivePermission(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  return required.some((permission) =>
    hasEffectivePermission(granted, permission),
  );
}
