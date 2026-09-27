# Preliminary failures and fixes

The results manifest preserves five failed preliminary attempts. The local harness reused named log files; compressed raw logs represent the final attempt and are not claimed as original failure logs.

- Formatting: a changed API-key fixture required canonical formatting.
- ESLint: four empty fake handler/class functions were replaced with meaningful stable fixtures; no rule was disabled.
- HTTP E2E first attempt: older direct PlatformGuard tests expected synchronous throws; manual grant-only contexts had no request-bound authentication proof. Tests now await the guard and explicitly bind synthetic identity. The onboarding helper had called RolesPermissionsGuard on AuthController.me despite that route not installing it; it now follows actual guard metadata.
- HTTP E2E second attempt: ClassesController's installed EntitlementGuard rejected the onboarding fixture with `No active subscription found for your tenant.` The test now seeds an active students-only subscription. Entitlement enforcement remains active.
- Final typecheck: TS2783 identified duplicate tenantSlug/email/authMethod defaults before an AuthContext spread in the synthetic helper. Defaults are now assigned after the spread with nullish fallback.

All final attempts passed. Focused and full suites remain enabled. The final exact-SHA full hosted workflow is the delivery gate.
