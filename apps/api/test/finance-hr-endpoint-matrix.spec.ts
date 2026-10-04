import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  getCanonicalPermissionByCode,
  getCanonicalPermissionForLegacyKey,
  hasEffectivePermission,
  permissionCatalog,
  systemRolePermissions,
} from '@schoolos/core';
import { PERMISSIONS_KEY } from '../src/auth/decorators/permissions.decorator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { SERVICE_AUTHORIZATION_KEY } from '../src/authorization/service-authorization.decorator';

/**
 * Phase 7.12 — required security tests "HR access does not imply payroll or
 * accounting access" and "accounting access does not imply HR document,
 * salary or bank access", as an endpoint × permission matrix over EVERY
 * controller route in the API.
 *
 * Each route's declared permissions are evaluated exactly as the
 * authorization kernel does (canonical → legacy key, then aliases, every
 * permission required). Service-level projections inside reachable routes
 * (for example staff detail sections) are covered by the 7.2 projection
 * tests and the DB-backed staff document tests.
 */

const SRC = join(__dirname, '..', 'src');

interface Route {
  key: string;
  file: string;
  permissions: string[];
  roles: string[];
  servicePolicy: string | null;
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return entry.endsWith('.controller.ts') ? [full] : [];
  });
}

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const file of controllerFiles(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, exported) as
        | string
        | string[]
        | undefined;
      if (base === undefined) continue;
      const classPermissions =
        (Reflect.getMetadata(PERMISSIONS_KEY, exported) as
          | string[]
          | undefined) ?? [];
      const classRoles =
        (Reflect.getMetadata(ROLES_KEY, exported) as string[] | undefined) ??
        [];
      const prototype = (exported as { prototype: Record<string, unknown> })
        .prototype;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') continue;
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as
          | string
          | string[]
          | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        if (path === undefined || method === undefined) continue;
        const methodPermissions = Reflect.getMetadata(
          PERMISSIONS_KEY,
          handler,
        ) as string[] | undefined;
        const methodRoles = Reflect.getMetadata(ROLES_KEY, handler) as
          | string[]
          | undefined;
        routes.push({
          key: `${RequestMethod[method]} /${[String(base), String(path)]
            .map((part) => part.replace(/^\/+|\/+$/g, ''))
            .filter(Boolean)
            .join('/')}`,
          file: relative(SRC, file),
          permissions: methodPermissions ?? classPermissions,
          roles: methodRoles ?? classRoles,
          servicePolicy:
            (Reflect.getMetadata(SERVICE_AUTHORIZATION_KEY, handler) as
              | string
              | undefined) ?? null,
        });
      }
    }
  }
  return routes;
}

const legacy = (key: string) =>
  (getCanonicalPermissionForLegacyKey(key) ?? getCanonicalPermissionByCode(key))
    ?.legacyKey ?? key;

/** The kernel's PERMISSION stage: every declared permission must be held. */
function reaches(granted: readonly string[], route: Route): boolean {
  if (route.permissions.length === 0) return false;
  const grants = granted.map(legacy);
  return route.permissions.every((required) =>
    hasEffectivePermission(grants, legacy(required)),
  );
}

const ALL_KEYS = permissionCatalog.map(
  (entry) => `${entry.resource}:${entry.action}`,
);
const startsWithAny = (key: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`));

/** HR person data that accounting must never reach through HR routes. */
const HR_SENSITIVE = [
  'hr:documents',
  'hr:identity',
  'hr:bank',
  'hr:tax',
  'hr:disciplinary',
  'hr:medical',
  'hr:safeguarding',
  'payroll:salary',
  'payroll:payslip',
  'payroll:bank-advice',
];
const PAYROLL_OR_ACCOUNTING = ['payroll', 'accounting', 'ledger'];
const FINANCE_FAMILIES = [
  'accounting',
  'ledger',
  'fees',
  'payments',
  'receipts',
  'finance',
];

/**
 * Routes whose guard permission is deliberately reachable through the
 * self-service alias (payroll:payslip:read ← staff:read) and whose service
 * returns only the caller's OWN record to such callers. Ownership is proved
 * in payroll.service.hardening.spec.ts ("Phase 7.12: never gives another
 * staff member's payslip…").
 */
const OWNER_GATED_IN_SERVICE = new Set([
  'GET /payroll/payslips/:payslipNumber/pdf',
  'GET /payroll/payslips/:payslipNumber.pdf',
]);

const requiresAny = (route: Route, prefixes: readonly string[]) =>
  route.permissions.some((permission) =>
    startsWithAny(legacy(permission), prefixes),
  );

describe('Phase 7.12 finance/HR endpoint × permission matrix', () => {
  const routes = collectRoutes();
  const hrSensitiveRoutes = routes.filter(
    (route) =>
      requiresAny(route, HR_SENSITIVE) &&
      !OWNER_GATED_IN_SERVICE.has(route.key),
  );
  const payrollAccountingRoutes = routes.filter(
    (route) =>
      requiresAny(route, PAYROLL_OR_ACCOUNTING) &&
      !OWNER_GATED_IN_SERVICE.has(route.key),
  );
  const accountingRoutes = routes.filter((route) =>
    requiresAny(route, ['accounting', 'ledger']),
  );

  it('inventories enough routes for the matrix to mean something', () => {
    expect(routes.length).toBeGreaterThan(500);
    expect(hrSensitiveRoutes.length).toBeGreaterThan(10);
    expect(payrollAccountingRoutes.length).toBeGreaterThan(80);
  });

  // Provider callbacks are unauthenticated by nature: the payload is
  // signature-checked and only a hint; settlement happens after the
  // server-to-server status pull (Phase 7.4).
  const PUBLIC_BY_DESIGN = new Set([
    'finance/payments-webhook.controller.ts POST /payments/online/webhook/:provider',
  ]);

  it('every finance, HR, payroll and accounting route declares its authority', () => {
    const unguarded = routes.filter(
      (route) =>
        !PUBLIC_BY_DESIGN.has(`${route.file} ${route.key}`) &&
        /^(accounting|finance|hr|payroll|staff)\//.test(route.file) &&
        route.permissions.length === 0 &&
        route.roles.length === 0 &&
        route.servicePolicy === null,
    );
    expect(unguarded.map((route) => `${route.file} ${route.key}`)).toEqual([]);
  });

  it('HR permissions alone reach no payroll or accounting route', () => {
    const hrOnly = ALL_KEYS.filter((key) =>
      startsWithAny(key, ['hr', 'staff']),
    );
    expect(hrOnly.length).toBeGreaterThan(20);
    const leaks = payrollAccountingRoutes.filter((route) =>
      reaches(hrOnly, route),
    );
    expect(leaks.map((route) => route.key)).toEqual([]);
  });

  it('every finance and accounting permission together reaches no HR document, identity, bank, tax, disciplinary, medical, safeguarding, salary or payslip route', () => {
    const financeOnly = [
      ...ALL_KEYS.filter((key) => startsWithAny(key, FINANCE_FAMILIES)),
      // Generic grants the accountant template also holds.
      'staff:read',
      'reports:read',
      'reports:export',
      'users:read',
      'roles:read',
    ];
    const leaks = hrSensitiveRoutes.filter((route) =>
      reaches(financeOnly, route),
    );
    expect(leaks.map((route) => route.key)).toEqual([]);
  });

  it.each([
    'accountant',
    'finance_clerk',
    'cashier',
    'finance_approver',
    'posting_authority',
    'financial_auditor',
  ])('the %s template reaches no HR-sensitive route', (template) => {
    const granted = systemRolePermissions[template];
    expect(granted.length).toBeGreaterThan(0);
    const leaks = hrSensitiveRoutes.filter((route) => reaches(granted, route));
    expect(leaks.map((route) => route.key)).toEqual([]);
  });

  it.each([
    'hr_manager',
    'payroll_preparer',
    'payroll_reviewer',
    'payroll_approver',
  ])('the %s template reaches no accounting route', (template) => {
    const granted = systemRolePermissions[template];
    expect(granted.length).toBeGreaterThan(0);
    const leaks = accountingRoutes.filter((route) => reaches(granted, route));
    expect(leaks.map((route) => route.key)).toEqual([]);
  });

  it('offers no teacher-eligibility override (decision D4): no route and no permission', () => {
    expect(
      routes
        .filter((route) => /eligib|professional-identity/i.test(route.key))
        .filter((route) => /override|waive|exempt/i.test(route.key))
        .map((route) => route.key),
    ).toEqual([]);
    expect(
      ALL_KEYS.filter(
        (key) => /eligib/i.test(key) && /override|waive|exempt/i.test(key),
      ),
    ).toEqual([]);
  });

  it('posting authority reaches payroll only through the accounting handoff and payroll posting routes', () => {
    const granted = systemRolePermissions.posting_authority;
    const payrollRoutes = routes.filter(
      (route) => requiresAny(route, ['payroll']) && reaches(granted, route),
    );
    for (const route of payrollRoutes) {
      expect([
        route.key,
        route.permissions.every((permission) =>
          ['payroll:read', 'payroll:run:read', 'payroll:run:post'].includes(
            legacy(permission),
          ),
        ),
      ]).toEqual([route.key, true]);
    }
  });
});
