import { OnlinePaymentIntentStatus, Prisma } from '@prisma/client';
import {
  deriveOnlinePaymentIntentState,
  describeOnlinePaymentVerificationMismatch,
  toOnlinePaymentWebhookResponse,
} from './online-payment-settlement';

describe('online payment settlement rules', () => {
  const intent = {
    id: 'intent-1',
    amount: new Prisma.Decimal('1500.00'),
    currency: 'NPR',
    providerReference: 'PR-1',
  };
  const verified = (
    overrides: Partial<{
      amount: Prisma.Decimal | null;
      currency: string | null;
      reference: string | null;
      providerReference: string | null;
      merchantId: string | null;
    }> = {},
  ) => ({
    found: true as const,
    status: 'SUCCESS' as const,
    amount: new Prisma.Decimal('1500.00') as Prisma.Decimal | null,
    currency: 'NPR' as string | null,
    reference: 'intent-1' as string | null,
    providerReference: 'PR-1' as string | null,
    merchantId: 'm-1' as string | null,
    ...overrides,
  });

  describe('describeOnlinePaymentVerificationMismatch', () => {
    it('accepts an exact match', () => {
      expect(
        describeOnlinePaymentVerificationMismatch(intent, verified(), 'm-1'),
      ).toBeNull();
    });

    it.each([
      ['amount', { amount: new Prisma.Decimal('1499.99') }, 'AMOUNT_MISMATCH'],
      ['missing amount', { amount: null }, 'AMOUNT_MISSING'],
      ['currency', { currency: 'USD' }, 'CURRENCY_MISMATCH'],
      [
        'provider reference',
        { providerReference: 'PR-2' },
        'PROVIDER_REFERENCE_MISMATCH',
      ],
      [
        'reference',
        { reference: 'other', providerReference: null },
        'REFERENCE_MISMATCH',
      ],
      ['merchant', { merchantId: 'm-2' }, 'MERCHANT_MISMATCH'],
      ['absent merchant', { merchantId: null }, 'MERCHANT_MISMATCH'],
    ])('flags a %s mismatch', (_label, override, code) => {
      expect(
        describeOnlinePaymentVerificationMismatch(
          intent,
          verified(override),
          'm-1',
        ),
      ).toBe(code);
    });

    it('confirms by provider reference alone when the intent echo is absent', () => {
      expect(
        describeOnlinePaymentVerificationMismatch(
          intent,
          verified({ reference: null }),
          'm-1',
        ),
      ).toBeNull();
    });

    it('does not confirm an intent that has no provider reference by a foreign echo', () => {
      expect(
        describeOnlinePaymentVerificationMismatch(
          { ...intent, providerReference: null },
          verified({ reference: null, providerReference: 'PR-9' }),
          'm-1',
        ),
      ).toBe('REFERENCE_MISMATCH');
    });
  });

  describe('deriveOnlinePaymentIntentState', () => {
    it.each([
      ['CREATED', null, 'AWAITING_PAYMENT'],
      ['READY', null, 'AWAITING_PAYMENT'],
      ['PENDING', null, 'PENDING_VERIFICATION'],
      ['SUCCEEDED', 'p-1', 'PAID'],
      ['SUCCEEDED', null, 'PENDING_VERIFICATION'],
      ['FAILED', null, 'FAILED'],
      ['EXPIRED', null, 'EXPIRED'],
    ])('%s with payment %p shows %s', (status, paymentId, expected) => {
      expect(
        deriveOnlinePaymentIntentState(
          status as OnlinePaymentIntentStatus,
          paymentId,
        ),
      ).toBe(expected);
    });
  });

  describe('toOnlinePaymentWebhookResponse', () => {
    it('never reports a pending or exception outcome as posted', () => {
      for (const outcome of [
        { kind: 'PENDING', reason: 'provider_pending' } as const,
        { kind: 'EXCEPTION', code: 'EXCEPTION_AMOUNT_MISMATCH' } as const,
        { kind: 'FAILED' } as const,
        { kind: 'EXPIRED' } as const,
        { kind: 'IGNORED', reason: 'tenant_suspended' } as const,
      ]) {
        expect(
          toOnlinePaymentWebhookResponse(outcome, 'SUCCESS').postedToLedger,
        ).toBe(false);
      }
    });

    it('labels a late failure callback after settlement as ignored', () => {
      expect(
        toOnlinePaymentWebhookResponse(
          { kind: 'SETTLED', paymentId: 'p-1', duplicate: true },
          'FAILED',
        ),
      ).toMatchObject({ status: 'ignored', postedToLedger: true });
    });
  });
});
