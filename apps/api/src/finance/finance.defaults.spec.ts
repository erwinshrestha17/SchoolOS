import { ChartAccountType } from '@prisma/client';
import { DEFAULT_CHART_ACCOUNTS } from './finance.defaults';

describe('DEFAULT_CHART_ACCOUNTS', () => {
  it('uses production reportable revenue accounts instead of legacy income accounts', () => {
    const accountsByCode = new Map(
      DEFAULT_CHART_ACCOUNTS.map((account) => [account.code, account]),
    );

    expect(accountsByCode.get('4000')).toMatchObject({
      name: 'Tuition Fee Income',
      type: ChartAccountType.REVENUE,
    });
    expect(accountsByCode.get('4010')).toMatchObject({
      type: ChartAccountType.REVENUE,
    });
    expect(
      DEFAULT_CHART_ACCOUNTS.some(
        (account) => account.type === ChartAccountType.INCOME,
      ),
    ).toBe(false);
  });

  it('includes accounts used by finance, payroll, library, and canteen posting', () => {
    const codes = new Set(
      DEFAULT_CHART_ACCOUNTS.map((account) => account.code),
    );

    for (const code of [
      '1200',
      '2200',
      '2210',
      '2220',
      '2300',
      '2400',
      '4040',
      '4050',
      '4100',
      '5020',
      '5100',
      '5200',
    ]) {
      expect(codes.has(code)).toBe(true);
    }
  });
});
