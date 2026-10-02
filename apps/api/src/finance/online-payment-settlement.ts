import { OnlinePaymentIntentStatus, type Prisma } from '@prisma/client';
import type {
  ProviderCallbackHint,
  ProviderVerification,
} from './online-payment-provider';

/** An open intent is retried by the reconciler once untouched this long. */
export const ONLINE_PAYMENT_STALE_MINUTES = 10;
/** A client-triggered verification is throttled per intent. */
export const ONLINE_PAYMENT_CLIENT_VERIFY_THROTTLE_MS = 30_000;
/** An intent the provider never completes is expired after this long. */
export const ONLINE_PAYMENT_MAX_PENDING_HOURS = 48;
/** failureCode prefix for verified payments parked for a person. */
export const ONLINE_PAYMENT_EXCEPTION_PREFIX = 'EXCEPTION_';

export type OnlinePaymentVerificationSource =
  | 'CALLBACK'
  | 'CLIENT_CONFIRM'
  | 'RECONCILER';

export type OnlinePaymentIntentOutcome =
  | { kind: 'SETTLED'; paymentId: string; duplicate: boolean }
  | { kind: 'FAILED' }
  | { kind: 'EXPIRED' }
  | {
      kind: 'PENDING';
      reason:
        | 'provider_pending'
        | 'provider_unavailable'
        | 'provider_not_configured'
        | 'merchant_unavailable';
    }
  | { kind: 'EXCEPTION'; code: string }
  | { kind: 'IGNORED'; reason: 'tenant_suspended' };

/**
 * Compares the provider's own answer with the immutable intent. Returns a
 * stable mismatch code, or null when amount, currency, reference and merchant
 * all agree. The callback payload never reaches this check.
 */
export function describeOnlinePaymentVerificationMismatch(
  intent: {
    id: string;
    amount: Prisma.Decimal;
    currency: string;
    providerReference: string | null;
  },
  verification: Extract<ProviderVerification, { found: true }>,
  merchantId: string,
): string | null {
  if (!verification.amount) return 'AMOUNT_MISSING';
  if (!verification.amount.equals(intent.amount)) return 'AMOUNT_MISMATCH';
  if (
    verification.currency &&
    verification.currency.trim().toUpperCase() !== intent.currency
  ) {
    return 'CURRENCY_MISMATCH';
  }
  if (
    verification.providerReference &&
    intent.providerReference &&
    verification.providerReference !== intent.providerReference
  ) {
    return 'PROVIDER_REFERENCE_MISMATCH';
  }
  const referenceConfirmed =
    verification.reference === intent.id ||
    (verification.providerReference !== null &&
      verification.providerReference === intent.providerReference);
  if (!referenceConfirmed) return 'REFERENCE_MISMATCH';
  if (verification.merchantId !== merchantId) return 'MERCHANT_MISMATCH';
  return null;
}

export type OnlinePaymentIntentState =
  | 'AWAITING_PAYMENT'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED';

/**
 * What a parent or cashier is shown. `PAID` only for a settled intent that
 * has a payment; a customer redirect or callback alone is
 * `PENDING_VERIFICATION`.
 */
export function deriveOnlinePaymentIntentState(
  status: OnlinePaymentIntentStatus,
  paymentId: string | null,
): OnlinePaymentIntentState {
  switch (status) {
    case OnlinePaymentIntentStatus.SUCCEEDED:
      return paymentId ? 'PAID' : 'PENDING_VERIFICATION';
    case OnlinePaymentIntentStatus.PENDING:
      return 'PENDING_VERIFICATION';
    case OnlinePaymentIntentStatus.FAILED:
      return 'FAILED';
    case OnlinePaymentIntentStatus.EXPIRED:
      return 'EXPIRED';
    default:
      return 'AWAITING_PAYMENT';
  }
}

export function toOnlinePaymentWebhookResponse(
  outcome: OnlinePaymentIntentOutcome,
  hint: ProviderCallbackHint,
) {
  switch (outcome.kind) {
    case 'SETTLED':
      if (outcome.duplicate && hint !== 'SUCCESS') {
        return {
          status: 'ignored',
          postedToLedger: true,
          duplicate: true,
          message:
            'A delayed callback was ignored because the payment is already confirmed.',
          paymentId: outcome.paymentId,
        };
      }
      return outcome.duplicate
        ? {
            status: 'verified',
            postedToLedger: true,
            duplicate: true,
            message: 'Payment already processed and posted.',
            paymentId: outcome.paymentId,
          }
        : {
            status: 'verified',
            postedToLedger: true,
            paymentId: outcome.paymentId,
            message: 'Online payment processed and posted to ledger.',
          };
    case 'FAILED':
    case 'EXPIRED':
      return {
        status: 'ignored',
        postedToLedger: false,
        message: `The provider confirmed this payment ${outcome.kind.toLowerCase()}; no payment was created.`,
      };
    case 'PENDING':
      return {
        status: 'pending_verification',
        postedToLedger: false,
        message:
          'The callback was acknowledged; settlement waits for server-side confirmation from the provider.',
      };
    case 'EXCEPTION':
      return {
        status: 'exception',
        postedToLedger: false,
        code: outcome.code,
        message:
          'The provider payment could not be verified against the payment intent. Nothing was settled; the school has been flagged to review it.',
      };
    case 'IGNORED':
      return {
        status: 'ignored',
        postedToLedger: false,
        message:
          'Payment settlement was not posted because the school account is suspended.',
      };
  }
}
