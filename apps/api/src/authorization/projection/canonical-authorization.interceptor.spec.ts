import { isActionAllowed } from '@schoolos/core';
import {
  attachCanonicalAuthorization,
  legacyActionCode,
} from './canonical-authorization.interceptor';

const ENABLED = { module: 'payroll', state: 'ENABLED' } as const;

describe('canonical authorization bridge (Phase 3A)', () => {
  it('maps legacy action names to canonical codes', () => {
    expect(legacyActionCode('canApprove')).toBe('APPROVE');
    expect(legacyActionCode('canCompleteReview')).toBe('COMPLETE_REVIEW');
    expect(legacyActionCode('approve')).toBe('APPROVE');
    expect(legacyActionCode('isLocked')).toBeNull();
    expect(legacyActionCode('bad-key')).toBeNull();
  });

  it('adds the canonical projection next to every legacy map, keeping the legacy map', () => {
    const body = {
      items: [
        {
          id: 'run-1',
          status: 'REVIEWED',
          allowedActions: { canApprove: true, canPost: false, isLocked: false },
        },
      ],
      total: 1,
    };

    const projected = attachCanonicalAuthorization(
      body,
      { module: 'payroll' },
      ENABLED,
    ) as typeof body & {
      items: { authorization: unknown; allowedActions: unknown }[];
    };

    const row = projected.items[0];
    expect(row.allowedActions).toEqual(body.items[0].allowedActions);
    expect(row.authorization).toEqual({
      contractVersion: 1,
      allowedActions: ['APPROVE'],
      capabilities: { APPROVE: true, POST: false },
      authorizedSections: [],
      lifecycleState: 'REVIEWED',
      entitlementState: ENABLED,
    });
    expect(isActionAllowed(row.authorization, 'APPROVE')).toBe(true);
    expect(isActionAllowed(row.authorization, 'POST')).toBe(false);
  });

  it('denies every action without entitlement evidence', () => {
    const projected = attachCanonicalAuthorization(
      { status: 'SUBMITTED', allowedActions: { review: true, approve: true } },
      { module: 'fees' },
      { module: 'fees', state: 'UNKNOWN' },
    ) as { authorization: unknown };

    expect(isActionAllowed(projected.authorization, 'REVIEW')).toBe(false);
    expect(isActionAllowed(projected.authorization, 'APPROVE')).toBe(false);
  });

  it('never overwrites an existing canonical projection', () => {
    const existing = { contractVersion: 1, allowedActions: [] };
    const projected = attachCanonicalAuthorization(
      { allowedActions: { approve: true }, authorization: existing },
      { module: 'payroll' },
      ENABLED,
    ) as { authorization: unknown };

    expect(projected.authorization).toBe(existing);
  });

  it('ignores string-array action lists and leaves non-plain values intact', () => {
    const when = new Date('2026-09-30T00:00:00.000Z');
    class Money {
      constructor(readonly value: string) {}
    }
    const amount = new Money('100.00');
    const projected = attachCanonicalAuthorization(
      { allowedActions: ['CLOSE'], when, amount },
      { module: 'accounting' },
      ENABLED,
    ) as Record<string, unknown>;

    expect(projected).not.toHaveProperty('authorization');
    expect(projected.when).toBe(when);
    expect(projected.amount).toBe(amount);
  });

  it('requires every legacy alias of one code to allow it', () => {
    const projected = attachCanonicalAuthorization(
      { allowedActions: { canReview: true, review: false } },
      { module: 'payroll' },
      ENABLED,
    ) as { authorization: unknown };

    expect(isActionAllowed(projected.authorization, 'REVIEW')).toBe(false);
  });
});
