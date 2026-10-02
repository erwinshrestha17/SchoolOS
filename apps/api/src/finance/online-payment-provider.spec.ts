import { BadRequestException } from '@nestjs/common';
import {
  GenericJsonV1Adapter,
  normalizeProviderStatus,
  ProviderUnavailableError,
  resolveOnlinePaymentAdapter,
} from './online-payment-provider';

describe('online payment provider adapter contract', () => {
  const config = {
    adapter: 'generic_json_v1',
    settlementStatusUrl: 'https://gateway.example.com/settlements/status',
    intentUrl: 'https://gateway.example.com/intents',
    apiToken: 'token-1',
  };
  const adapter = new GenericJsonV1Adapter(config);
  const verifyInput = {
    intentId: 'intent-1',
    providerReference: 'PR-1',
    merchantId: 'merchant-1',
  };
  const answer = (status: number, body: unknown) =>
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response);

  afterEach(() => jest.restoreAllMocks());

  it('resolves only implemented adapters (fail closed)', () => {
    expect(resolveOnlinePaymentAdapter(config)).toBeInstanceOf(
      GenericJsonV1Adapter,
    );
    expect(resolveOnlinePaymentAdapter({ adapter: 'esewa_v2' })).toBeNull();
    expect(resolveOnlinePaymentAdapter(null)).toBeNull();
  });

  it('normalises provider status vocabulary', () => {
    expect(normalizeProviderStatus('payment.success')).toBe('SUCCESS');
    expect(normalizeProviderStatus('Declined')).toBe('FAILED');
    expect(normalizeProviderStatus('processing')).toBe('PENDING');
    expect(normalizeProviderStatus('???')).toBe('UNKNOWN');
    expect(normalizeProviderStatus(undefined)).toBe('UNKNOWN');
  });

  describe('parseCallback', () => {
    it('extracts a reference and only a status hint', () => {
      expect(
        adapter.parseCallback({
          providerReference: 'PR-1',
          status: 'COMPLETED',
          amount: 1,
        }),
      ).toEqual({ reference: 'PR-1', statusHint: 'SUCCESS' });
      expect(adapter.parseCallback({ intentId: 'i-1', event: 'nope' })).toEqual(
        { reference: 'i-1', statusHint: 'UNKNOWN' },
      );
    });

    it('requires a reference', () => {
      expect(() => adapter.parseCallback({ status: 'SUCCESS' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyStatus', () => {
    it('pulls the status with our reference, the provider reference and the merchant', async () => {
      const spy = answer(200, {
        status: 'PAID',
        amount: '1500.00',
        currency: 'NPR',
        reference: 'intent-1',
        providerReference: 'PR-1',
        merchantId: 'merchant-1',
      });

      const result = await adapter.verifyStatus(verifyInput);

      const url = spy.mock.calls[0][0] as URL;
      expect(url.searchParams.get('reference')).toBe('intent-1');
      expect(url.searchParams.get('providerReference')).toBe('PR-1');
      expect(url.searchParams.get('merchantId')).toBe('merchant-1');
      expect(spy.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'GET',
          redirect: 'error',
          headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
        }),
      );
      expect(result).toMatchObject({
        found: true,
        status: 'SUCCESS',
        currency: 'NPR',
        reference: 'intent-1',
        providerReference: 'PR-1',
        merchantId: 'merchant-1',
      });
      expect(result.found && result.amount?.toFixed(2)).toBe('1500.00');
    });

    it('reports an unknown payment as not found', async () => {
      answer(404, null);
      await expect(adapter.verifyStatus(verifyInput)).resolves.toEqual({
        found: false,
      });
    });

    it.each([
      ['server error', 500, null],
      ['empty body', 200, null],
      ['unrecognised status', 200, { status: 'weird' }],
    ])('treats a %s as provider unavailable', async (_l, status, body) => {
      answer(status, body);
      await expect(adapter.verifyStatus(verifyInput)).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    });

    it('treats a network failure as provider unavailable', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
      await expect(adapter.verifyStatus(verifyInput)).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    });

    it.each(['1e3', '-5', 'NaN', '12.1234567', ''])(
      'does not accept the malformed amount %p',
      async (amount) => {
        answer(200, { status: 'SUCCESS', amount });
        const result = await adapter.verifyStatus(verifyInput);
        expect(result.found && result.amount).toBeNull();
      },
    );

    it('is unavailable without a settlement status URL', async () => {
      await expect(
        new GenericJsonV1Adapter({ adapter: 'generic_json_v1' }).verifyStatus(
          verifyInput,
        ),
      ).rejects.toBeInstanceOf(ProviderUnavailableError);
    });
  });
});
