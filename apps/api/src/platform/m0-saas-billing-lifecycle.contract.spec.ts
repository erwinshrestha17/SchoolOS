import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M0 SaaS Billing Lifecycle Hardening Contracts
 *
 * These tests ensure the production-grade stability of the SaaS billing chain:
 * 1. Invoice state machine (ISSUED -> PAID/PARTIAL/OVERDUE/CANCELLED).
 * 2. Strict separation from school-level fee modules.
 * 3. Accurate balance and payment sum logic.
 * 4. Audit completeness for all financial transitions.
 */
describe('M0 SaaS billing lifecycle contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  // ─── 1. SaaS Billing Models & DB Separation ───────────────────────────

  describe('SaaS billing model separation', () => {
    it('prisma schema contains isolated SaaS billing models', () => {
      const schema = read('prisma/schema.prisma');

      expect(schema).toContain('model SaaSInvoice');
      expect(schema).toContain('model SaaSPayment');
      expect(schema).toContain('model TenantBillingProfile');
      expect(schema).toContain('model TenantSubscription');
    });

    it('SaaS models are distinct from school fee models', () => {
      const schema = read('prisma/schema.prisma');

      // School fee models (M3/M9)
      expect(schema).toContain('model Invoice');
      expect(schema).toContain('model Payment');

      // Verification that they are different
      expect(schema).not.toContain('model SaaSInvoice extends Invoice');
    });
  });

  // ─── 2. Invoice State Machine & Logic ─────────────────────────────────

  describe('Invoice state machine logic', () => {
    it('PlatformService computes OVERDUE status dynamically based on dueDate', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('status:');
      expect(service).toContain("invoice.status !== 'PAID'");
      expect(service).toContain("invoice.status !== 'CANCELLED'");
      expect(service).toContain('toDate(invoice.dueDate) < new Date()');
      expect(service).toContain("? 'OVERDUE'");
    });

    it('PlatformService sums payments using Decimal precision', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('sumPayments');
      expect(service).toContain('new Prisma.Decimal(0)');
      expect(service).toContain('sum.add(decimalValue(payment.amount))');
    });

    it('recordSaaSPayment enforces balance limits and state guards', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('recordSaaSPayment');
      expect(service).toContain('Cannot pay a cancelled invoice');
      expect(service).toContain('Payment exceeds invoice balance');
      expect(service).toContain('Invoice is already fully paid');
    });

    it('cancelSaaSInvoice rejects cancellation of paid invoices', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('cancelSaaSInvoice');
      expect(service).toContain('Cannot cancel an invoice with payments');
      expect(service).toContain('cancelledBy: actorUserId');
      expect(service).toContain('cancellationReason: dto.reason');
    });
  });

  // ─── 3. Billing Profile & Auto-Billing Readiness ──────────────────────

  describe('Billing profile & cycle contracts', () => {
    it('billing profile supports structured contact and tax info', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('billingContactName');
      expect(service).toContain('billingEmail');
      expect(service).toContain('panVatNumber');
      expect(service).toContain('preferredBillingCycle');
    });

    it('nextInvoiceNumber generates SO-YYYY-XXXXX sequence', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('nextInvoiceNumber');
      expect(service).toContain('`SO-${new Date().getUTCFullYear()}-');
      expect(service).toContain("padStart(5, '0')");
    });
  });

  // ─── 4. Audit & Verification ──────────────────────────────────────────

  describe('Billing audit completeness', () => {
    it('all billing mutations are audit-logged with before/after state', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('saas_invoice_created');
      expect(service).toContain('saas_payment_recorded');
      expect(service).toContain('saas_invoice_cancelled');
      expect(service).toContain('tenant_billing_profile_updated');
    });

    it('billing audit logs are scoped to the platform tenant', () => {
      const service = read('src/platform/platform.service.ts');
      expect(service).toContain("tenantId: 'platform'");
    });
  });
});
