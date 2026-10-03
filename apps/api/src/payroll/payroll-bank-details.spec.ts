import { maskBankAccount, validateBankDetails } from './payroll-bank-details';

describe('validateBankDetails (generic, bank-agnostic)', () => {
  it('accepts a plain account and bank name', () => {
    expect(
      validateBankDetails({ bankAccount: '0123456789012', bankName: 'Bank' }),
    ).toEqual([]);
    expect(
      validateBankDetails({ bankAccount: 'AB-12/345 678', bankName: 'Bank' }),
    ).toEqual([]);
  });

  it('reports missing and invalid values as machine-readable problems', () => {
    expect(validateBankDetails({ bankAccount: null, bankName: null })).toEqual([
      'BANK_ACCOUNT_MISSING',
      'BANK_NAME_MISSING',
    ]);
    expect(
      validateBankDetails({ bankAccount: '   ', bankName: 'Bank' }),
    ).toEqual(['BANK_ACCOUNT_MISSING']);
    for (const bankAccount of [
      '12',
      '=1+1',
      '12;34',
      '1'.repeat(40),
      '"12345"',
    ])
      expect(validateBankDetails({ bankAccount, bankName: 'Bank' })).toEqual([
        'BANK_ACCOUNT_INVALID',
      ]);
    expect(
      validateBankDetails({ bankAccount: '12345', bankName: 'x'.repeat(101) }),
    ).toEqual(['BANK_NAME_MISSING']);
  });

  it('masks all but the last four characters', () => {
    expect(maskBankAccount('0123456789')).toBe('••••6789');
    expect(maskBankAccount('123')).toBe('••••');
  });
});
