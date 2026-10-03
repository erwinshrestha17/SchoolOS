import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import {
  assertClosePreviewAccepted,
  buildClosingLines,
  closePreviewFingerprint,
  closingPostingType,
  projectCloseItems,
  type CloseItem,
} from './fiscal-close-inventory';

const D = (value: number | string) => new Prisma.Decimal(value);
const retained = { id: 're', code: '3100', name: 'Retained surplus' };

describe('fiscal close inventory (Phase 7.11d)', () => {
  describe('buildClosingLines', () => {
    it('closes income and expense into retained earnings', () => {
      const { lines, netResult } = buildClosingLines(
        [
          {
            accountId: 'rev',
            code: '4000',
            name: 'Tuition',
            type: 'REVENUE',
            debit: D(0),
            credit: D(1000),
          },
          {
            accountId: 'inc',
            code: '4100',
            name: 'Hall hire',
            type: 'INCOME',
            debit: D(0),
            credit: D(200),
          },
          {
            accountId: 'exp',
            code: '5000',
            name: 'Salaries',
            type: 'EXPENSE',
            debit: D(700),
            credit: D(0),
          },
        ],
        retained,
      );
      expect(
        lines.map((l) => [l.code, l.debit.toFixed(2), l.credit.toFixed(2)]),
      ).toEqual([
        ['4000', '1000.00', '0.00'],
        ['4100', '200.00', '0.00'],
        ['5000', '0.00', '700.00'],
        ['3100', '0.00', '500.00'],
      ]);
      expect(netResult.toFixed(2)).toBe('500.00');
    });

    it('closes an income account with a debit balance by crediting it (never a negative line)', () => {
      const { lines, netResult } = buildClosingLines(
        [
          {
            accountId: 'rev',
            code: '4000',
            name: 'Tuition',
            type: 'REVENUE',
            debit: D(300),
            credit: D(100),
          },
        ],
        retained,
      );
      expect(
        lines.map((l) => [l.code, l.debit.toFixed(2), l.credit.toFixed(2)]),
      ).toEqual([
        ['4000', '0.00', '200.00'],
        ['3100', '200.00', '0.00'],
      ]);
      expect(netResult.toFixed(2)).toBe('-200.00');
      for (const line of lines) {
        expect(line.debit.gte(0) && line.credit.gte(0)).toBe(true);
      }
    });

    it('produces nothing when every balance is already closed', () => {
      expect(
        buildClosingLines(
          [
            {
              accountId: 'rev',
              code: '4000',
              name: 'Tuition',
              type: 'REVENUE',
              debit: D(500),
              credit: D(500),
            },
          ],
          retained,
        ).lines,
      ).toEqual([]);
    });
  });

  it('keeps the original key for a first close and numbers supplementary closes', () => {
    expect(closingPostingType(0)).toBe('FISCAL_YEAR_CLOSE');
    expect(closingPostingType(1)).toBe('FISCAL_YEAR_CLOSE:2');
    expect(closingPostingType(2)).toBe('FISCAL_YEAR_CLOSE:3');
  });

  const payrollItem: CloseItem = {
    code: 'PAYROLL_POSTING_INCOMPLETE',
    severity: 'BLOCKING',
    count: 3,
    amount: null,
    message: 'm',
    consequence: 'c',
    resolutionRoute: '/r',
    readPermissions: ['payroll:read'],
  };
  const actorWith = (permissions: string[]) =>
    ({
      userId: 'u',
      tenantId: 't',
      roles: ['x'],
      permissions,
    }) as unknown as AuthContext;

  it('shows a count only to someone who may act on it, never a zero', () => {
    const [hidden] = projectCloseItems(
      [payrollItem],
      actorWith(['accounting:reports:read']),
    );
    expect(hidden).toMatchObject({
      code: 'PAYROLL_POSTING_INCOMPLETE',
      severity: 'BLOCKING',
      count: null,
      restricted: true,
    });
    const [shown] = projectCloseItems(
      [payrollItem],
      actorWith(['payroll:read']),
    );
    expect(shown).toMatchObject({ count: 3, restricted: false });
  });

  it('does not let the fingerprint reveal a restricted count', () => {
    const viewer = actorWith(['accounting:reports:read']);
    const fingerprint = (count: number) =>
      closePreviewFingerprint({
        kind: 'PERIOD',
        targetId: 'p',
        status: 'LOCKED',
        items: projectCloseItems([{ ...payrollItem, count }], viewer),
      });
    expect(fingerprint(3)).toBe(fingerprint(7));
    const reader = actorWith(['payroll:read']);
    const visible = (count: number) =>
      closePreviewFingerprint({
        kind: 'PERIOD',
        targetId: 'p',
        status: 'LOCKED',
        items: projectCloseItems([{ ...payrollItem, count }], reader),
      });
    expect(visible(3)).not.toBe(visible(7));
  });

  it('accepts a close only with the current fingerprint, no blockers and every warning acknowledged', () => {
    const warning = {
      code: 'DRAFT_INVOICES',
      severity: 'WARNING' as const,
      count: 1,
      amount: null,
      restricted: false,
      message: 'm',
      consequence: 'c',
      resolutionRoute: '/r',
    };
    const preview = {
      previewFingerprint: 'a'.repeat(64),
      blockers: [],
      requiredAcknowledgements: [warning.code],
    };
    const code = (fn: () => void) => {
      try {
        fn();
        return 'OK';
      } catch (error) {
        return (error as { response?: { code?: string } }).response?.code;
      }
    };
    expect(
      code(() => {
        assertClosePreviewAccepted(preview, {});
      }),
    ).toBe('CLOSE_PREVIEW_REQUIRED');
    expect(
      code(() => {
        assertClosePreviewAccepted(preview, {
          expectedPreviewFingerprint: 'b'.repeat(64),
        });
      }),
    ).toBe('CLOSE_PREVIEW_STALE');
    expect(
      code(() => {
        assertClosePreviewAccepted(preview, {
          expectedPreviewFingerprint: 'a'.repeat(64),
        });
      }),
    ).toBe('CLOSE_WARNINGS_NOT_ACKNOWLEDGED');
    expect(
      code(() => {
        assertClosePreviewAccepted(
          { ...preview, blockers: [{ ...warning, severity: 'BLOCKING' }] },
          {
            expectedPreviewFingerprint: 'a'.repeat(64),
            acknowledgedWarningCodes: [warning.code],
          },
        );
      }),
    ).toBe('CLOSE_BLOCKED');
    expect(
      code(() => {
        assertClosePreviewAccepted(preview, {
          expectedPreviewFingerprint: 'a'.repeat(64),
          acknowledgedWarningCodes: [warning.code],
        });
      }),
    ).toBe('OK');
  });
});
