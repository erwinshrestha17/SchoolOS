import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parsePaymentProviderOutboundUrl } from '../common/security/outbound-url';

/**
 * Provider adapter contract for online fee collection (Phase 7.4).
 *
 * The contract is deliberately small and provider-neutral:
 *  - `initiate`      starts a checkout for one immutable payment intent,
 *  - `verifyStatus`  pulls the authoritative payment state from the provider
 *                    (server-to-server) for an intent,
 *  - `parseCallback` extracts the intent reference and a status *hint* from a
 *                    signed provider callback.
 *
 * A callback is a hint. Money is only ever settled from the result of
 * `verifyStatus`, after the amount, currency, reference and merchant have been
 * compared with the immutable intent.
 */

export type ProviderPaymentState = 'SUCCESS' | 'FAILED' | 'PENDING';

export type ProviderCallbackHint = ProviderPaymentState | 'UNKNOWN';

export interface ProviderInitiateInput {
  intentId: string;
  invoiceNumber: string;
  amount: Prisma.Decimal;
  idempotencyKey: string;
  merchantId: string;
}

export interface ProviderInitiateResult {
  providerReference: string;
  checkoutUrl: string;
  expiresAt: Date | null;
}

export interface ProviderVerifyInput {
  intentId: string;
  providerReference: string | null;
  merchantId: string;
}

export type ProviderVerification =
  | { found: false }
  | {
      found: true;
      status: ProviderPaymentState;
      amount: Prisma.Decimal | null;
      currency: string | null;
      /** Our intent id echoed back by the provider. */
      reference: string | null;
      providerReference: string | null;
      merchantId: string | null;
    };

export interface ParsedProviderCallback {
  /** Intent id or provider reference named by the callback. */
  reference: string;
  statusHint: ProviderCallbackHint;
}

export interface OnlinePaymentProviderAdapter {
  initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult>;
  verifyStatus(input: ProviderVerifyInput): Promise<ProviderVerification>;
  parseCallback(payload: Record<string, unknown>): ParsedProviderCallback;
}

/** Raised when the provider cannot be reached or answers unusably. */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export const GENERIC_JSON_ADAPTER = 'generic_json_v1';

/**
 * Resolves the adapter named by a decrypted provider configuration. Returns
 * null when the adapter is not implemented, so callers fail closed.
 */
export function resolveOnlinePaymentAdapter(
  config: Record<string, unknown> | null,
): OnlinePaymentProviderAdapter | null {
  if (config?.adapter === GENERIC_JSON_ADAPTER) {
    return new GenericJsonV1Adapter(config);
  }
  return null;
}

export function normalizeProviderStatus(value: unknown): ProviderCallbackHint {
  const normalized = (typeof value === 'string' ? value : '')
    .trim()
    .toUpperCase();

  if (
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'PAID' ||
    normalized === 'PAYMENT_SUCCESS' ||
    normalized === 'PAYMENT_COMPLETED' ||
    normalized === 'PAYMENT.SUCCESS' ||
    normalized === 'PAYMENT.COMPLETED'
  ) {
    return 'SUCCESS';
  }

  if (
    normalized === 'FAILED' ||
    normalized === 'FAILURE' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED' ||
    normalized === 'EXPIRED' ||
    normalized === 'DECLINED' ||
    normalized === 'PAYMENT.FAILED' ||
    normalized === 'PAYMENT.CANCELLED' ||
    normalized === 'PAYMENT.CANCELED'
  ) {
    return 'FAILED';
  }

  if (
    normalized === 'PENDING' ||
    normalized === 'PROCESSING' ||
    normalized === 'AUTHORIZED' ||
    normalized === 'INITIATED' ||
    normalized === 'DELAYED' ||
    normalized === 'PAYMENT.PENDING' ||
    normalized === 'PAYMENT.PROCESSING'
  ) {
    return 'PENDING';
  }

  return 'UNKNOWN';
}

function firstString(
  source: Record<string, unknown> | null,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function parseDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  // Plain non-negative decimal notation only: no exponents, signs or NaN.
  const text = String(value).trim();
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(text)) return null;
  return new Prisma.Decimal(text);
}

/**
 * The JSON-over-HTTPS adapter used by the sandbox gateway and by providers
 * that expose a plain JSON API. Live provider-specific adapters (eSewa,
 * Khalti, …) implement the same interface once merchant credentials exist.
 *
 * Verify contract: `GET <settlementStatusUrl>?reference=<intentId>
 * &providerReference=<ref>&merchantId=<id>` answers
 * `{ status, amount, currency, reference, providerReference, merchantId }`;
 * HTTP 404 means the provider has no such payment.
 */
export class GenericJsonV1Adapter implements OnlinePaymentProviderAdapter {
  constructor(private readonly config: Record<string, unknown>) {}

  async initiate(
    input: ProviderInitiateInput,
  ): Promise<ProviderInitiateResult> {
    const intentUrl = firstString(this.config, ['initiateUrl', 'intentUrl']);
    if (!intentUrl) {
      throw new BadRequestException('Payment intent URL is not configured.');
    }
    let parsedUrl: URL;
    try {
      parsedUrl = parsePaymentProviderOutboundUrl(
        intentUrl,
        'Payment intent URL',
      );
    } catch {
      throw new BadRequestException('Payment intent URL is invalid.');
    }
    const callbackUrl = firstString(this.config, ['webhookUrl', 'callbackUrl']);
    const returnUrl = firstString(this.config, ['returnUrl']);
    const apiToken = firstString(this.config, ['apiToken', 'accessToken']);
    const response = await fetch(parsedUrl, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        merchantId: input.merchantId,
        amount: Number(input.amount),
        currency: 'NPR',
        reference: input.intentId,
        invoiceNumber: input.invoiceNumber,
        callbackUrl,
        returnUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !payload) {
      throw new BadRequestException(
        'The payment provider rejected this payment request.',
      );
    }

    const checkoutUrl = firstString(payload, [
      'checkoutUrl',
      'paymentUrl',
      'redirectUrl',
    ]);
    const providerReference = firstString(payload, [
      'providerReference',
      'transactionId',
      'reference',
      'id',
    ]);
    if (!checkoutUrl || !providerReference) {
      throw new BadRequestException(
        'The payment provider returned an incomplete payment intent.',
      );
    }
    let checkout: URL;
    try {
      checkout = parsePaymentProviderOutboundUrl(
        checkoutUrl,
        'Payment checkout URL',
      );
    } catch {
      throw new BadRequestException(
        'The payment provider returned an unsafe checkout URL.',
      );
    }
    const expiresAtValue = firstString(payload, ['expiresAt', 'expiry']);
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;

    return {
      providerReference,
      checkoutUrl: checkout.toString(),
      expiresAt:
        expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    };
  }

  async verifyStatus(
    input: ProviderVerifyInput,
  ): Promise<ProviderVerification> {
    const statusUrl = firstString(this.config, ['settlementStatusUrl']);
    if (!statusUrl) {
      throw new ProviderUnavailableError(
        'Settlement status URL is not configured.',
      );
    }
    let url: URL;
    try {
      url = parsePaymentProviderOutboundUrl(statusUrl, 'Settlement status URL');
    } catch {
      throw new ProviderUnavailableError('Settlement status URL is invalid.');
    }
    url.searchParams.set('reference', input.intentId);
    if (input.providerReference) {
      url.searchParams.set('providerReference', input.providerReference);
    }
    url.searchParams.set('merchantId', input.merchantId);
    const apiToken = firstString(this.config, ['apiToken', 'accessToken']);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ProviderUnavailableError(
        'The payment provider could not be reached.',
      );
    }
    if (response.status === 404) return { found: false };
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !payload) {
      throw new ProviderUnavailableError(
        'The payment provider returned an unusable status response.',
      );
    }
    const status = normalizeProviderStatus(payload.status);
    if (status === 'UNKNOWN') {
      throw new ProviderUnavailableError(
        'The payment provider returned an unrecognised payment status.',
      );
    }
    return {
      found: true,
      status,
      amount: parseDecimal(payload.amount),
      currency: firstString(payload, ['currency']),
      reference: firstString(payload, ['reference', 'intentId']),
      providerReference: firstString(payload, [
        'providerReference',
        'transactionId',
      ]),
      merchantId: firstString(payload, ['merchantId']),
    };
  }

  parseCallback(payload: Record<string, unknown>): ParsedProviderCallback {
    const reference = firstString(payload, [
      'intentId',
      'providerReference',
      'reference',
    ]);
    if (!reference) {
      throw new BadRequestException('Webhook reference is required.');
    }
    return {
      reference,
      statusHint: normalizeProviderStatus(payload.status ?? payload.event),
    };
  }
}
