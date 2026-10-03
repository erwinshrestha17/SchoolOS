import { Prisma } from '@prisma/client';
import {
  computeStatutoryAmount,
  computeStatutoryForLine,
  parseStatutoryPolicyPayload,
  statutoryBreakdownJson,
  StatutoryConfigurationError,
  StatutoryPolicyInvalidError,
} from './statutory-policy';

// FIXTURE numbers only: these are not Nepal statutory rates.
const D = (value: string | number) => new Prisma.Decimal(value);

function invalid(payload: unknown) {
  try {
    parseStatutoryPolicyPayload(payload);
  } catch (error) {
    expect(error).toBeInstanceOf(StatutoryPolicyInvalidError);
    return (error as StatutoryPolicyInvalidError).reasons.join(' | ');
  }
  throw new Error('expected the payload to be rejected');
}

describe('statutory policy payload contract', () => {
  it('parses flat and marginal-slab schemes into decimals', () => {
    const policy = parseStatutoryPolicyPayload({
      schemes: [
        {
          code: 'SSF',
          base: 'BASIC',
          employeeRate: '0.05',
          employerRate: '0.10',
          baseCap: '100000',
          requiresIdentifier: true,
        },
        {
          code: 'REMUNERATION_TAX',
          base: 'GROSS',
          method: 'MARGINAL_SLABS',
          slabs: [
            { upTo: '10000', rate: '0' },
            { upTo: '30000', rate: '0.10' },
            { upTo: null, rate: '0.20' },
          ],
        },
      ],
    });
    expect(policy.schemes[0]).toMatchObject({
      code: 'SSF',
      requiresIdentifier: true,
      baseCap: D(100000),
    });
    expect(policy.schemes[0].employeeRate).toEqual(D('0.05'));
    expect(policy.schemes[1].slabs).toHaveLength(3);
  });

  it.each([
    [{ schemes: [] }, 'must not be empty'],
    [{}, 'schemes must be an array'],
    [
      { schemes: [{ code: 'PF', base: 'BASIC', employeeRate: 0.1 }] },
      'decimal string',
    ],
    [
      { schemes: [{ code: 'PF', base: 'BASIC', employeeRate: '1.5' }] },
      'between 0 and 1',
    ],
    [
      { schemes: [{ code: 'PF', base: 'BASIC' }] },
      'employeeRate or employerRate',
    ],
    [
      {
        schemes: [
          { code: 'PF', base: 'BASIC', employeeRate: '0.1' },
          { code: 'PF', base: 'BASIC', employeeRate: '0.1' },
        ],
      },
      'more than once',
    ],
    [
      { schemes: [{ code: 'CIT', base: 'BASIC', employeeRate: '0.1' }] },
      'CIT is not supported',
    ],
    [
      { schemes: [{ code: 'XYZ', base: 'BASIC', employeeRate: '0.1' }] },
      'code must be one of',
    ],
    [
      { schemes: [{ code: 'PF', base: 'NET', employeeRate: '0.1' }] },
      'base must be one of',
    ],
    [
      {
        schemes: [
          {
            code: 'REMUNERATION_TAX',
            base: 'GROSS',
            employeeRate: '0.1',
            employerRate: '0.1',
          },
        ],
      },
      'no employer rate',
    ],
    [
      {
        schemes: [
          {
            code: 'PF',
            base: 'BASIC',
            method: 'MARGINAL_SLABS',
            slabs: [{ upTo: null, rate: '0.1' }],
          },
        ],
      },
      'only REMUNERATION_TAX',
    ],
    [
      {
        schemes: [
          {
            code: 'REMUNERATION_TAX',
            base: 'GROSS',
            method: 'MARGINAL_SLABS',
            slabs: [
              { upTo: '20000', rate: '0.1' },
              { upTo: '10000', rate: '0.2' },
              { upTo: null, rate: '0.3' },
            ],
          },
        ],
      },
      'must increase',
    ],
    [
      {
        schemes: [
          {
            code: 'REMUNERATION_TAX',
            base: 'GROSS',
            method: 'MARGINAL_SLABS',
            slabs: [{ upTo: '20000', rate: '0.1' }],
          },
        ],
      },
      'null on the last band',
    ],
  ])('rejects %j', (payload, expected) => {
    expect(invalid(payload)).toContain(expected);
  });
});

describe('statutory calculation', () => {
  const amounts = {
    basic: D(30000),
    basicPlusAllowances: D(40000),
    gross: D(45000),
  };

  it('applies the chosen base, then the cap, then the rate', () => {
    const policy = parseStatutoryPolicyPayload({
      schemes: [
        {
          code: 'SSF',
          base: 'BASIC_PLUS_ALLOWANCES',
          employeeRate: '0.10',
          employerRate: '0.20',
          baseCap: '25000',
        },
      ],
    });
    const result = computeStatutoryAmount(policy.schemes[0], amounts);
    expect(result.baseAmount).toEqual(D(25000));
    expect(result.employee).toEqual(D(2500));
    expect(result.employer).toEqual(D(5000));
  });

  it('computes marginal slabs band by band', () => {
    const policy = parseStatutoryPolicyPayload({
      schemes: [
        {
          code: 'REMUNERATION_TAX',
          base: 'GROSS',
          method: 'MARGINAL_SLABS',
          slabs: [
            { upTo: '10000', rate: '0' },
            { upTo: '30000', rate: '0.10' },
            { upTo: null, rate: '0.20' },
          ],
        },
      ],
    });
    const rule = policy.schemes[0];
    // 0 on 10k, 10% on next 20k = 2000, 20% on remaining 15k = 3000.
    expect(computeStatutoryAmount(rule, amounts).employee).toEqual(D(5000));
    expect(
      computeStatutoryAmount(rule, { ...amounts, gross: D(8000) }).employee,
    ).toEqual(D(0));
    expect(
      computeStatutoryAmount(rule, { ...amounts, gross: D(30000) }).employee,
    ).toEqual(D(2000));
  });

  it('rounds to two decimals using exact decimal arithmetic', () => {
    const policy = parseStatutoryPolicyPayload({
      schemes: [{ code: 'PF', base: 'BASIC', employeeRate: '0.0333' }],
    });
    const result = computeStatutoryAmount(policy.schemes[0], {
      ...amounts,
      basic: D('33333.33'),
    });
    expect(result.employee).toEqual(D('1110.00'));
  });

  describe('computeStatutoryForLine', () => {
    const policy = parseStatutoryPolicyPayload({
      schemes: [
        { code: 'PF', base: 'BASIC', employeeRate: '0.1', employerRate: '0.1' },
      ],
    });

    it('owes nothing, and needs no policy, with no enrolment', () => {
      const result = computeStatutoryForLine(
        null,
        { retirementScheme: null, taxWithholding: false },
        amounts,
      );
      expect(result.amounts).toEqual([]);
      expect(result.pfEmployee).toEqual(D(0));
    });

    it('fails when a needed policy is absent', () => {
      expect.assertions(2);
      try {
        computeStatutoryForLine(
          null,
          { retirementScheme: 'PF', taxWithholding: false },
          amounts,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(StatutoryConfigurationError);
        expect((error as StatutoryConfigurationError).code).toBe(
          'STATUTORY_POLICY_REQUIRED',
        );
      }
    });

    it('fails when the policy lacks a scheme someone owes', () => {
      expect.assertions(1);
      try {
        computeStatutoryForLine(
          policy,
          { retirementScheme: 'SSF', taxWithholding: false },
          amounts,
        );
      } catch (error) {
        expect((error as StatutoryConfigurationError).code).toBe(
          'STATUTORY_SCHEME_NOT_IN_POLICY',
        );
      }
    });

    it('records the breakdown without identifiers', () => {
      const result = computeStatutoryForLine(
        policy,
        { retirementScheme: 'PF', taxWithholding: false },
        amounts,
      );
      expect(statutoryBreakdownJson('version-1', result.amounts)).toEqual({
        schemaVersion: 1,
        policyVersionId: 'version-1',
        schemes: [
          {
            code: 'PF',
            base: 'BASIC',
            baseAmount: '30000.00',
            employee: '3000.00',
            employer: '3000.00',
          },
        ],
      });
    });
  });
});
