/**
 * Phase 7.9: the generic, bank-agnostic validity rule for the bank payment
 * advice. Staff is the single source of bank details (7.8). No bank-specific
 * account format is encoded here — a school's bank format needs an
 * authoritative specification first — only what any payment instruction needs
 * to be unambiguous and safe to put in a CSV.
 */
export type BankDetailsProblem =
  | 'BANK_ACCOUNT_MISSING'
  | 'BANK_ACCOUNT_INVALID'
  | 'BANK_NAME_MISSING';

const ACCOUNT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 \-/]{2,33}$/;

export function validateBankDetails(input: {
  bankAccount: string | null | undefined;
  bankName: string | null | undefined;
}): BankDetailsProblem[] {
  const problems: BankDetailsProblem[] = [];
  const account = input.bankAccount?.trim() ?? '';
  if (!account) problems.push('BANK_ACCOUNT_MISSING');
  else if (!ACCOUNT_PATTERN.test(account))
    problems.push('BANK_ACCOUNT_INVALID');
  const bank = input.bankName?.trim() ?? '';
  if (!bank || bank.length > 100) problems.push('BANK_NAME_MISSING');
  return problems;
}

/** Last four characters only; the full account never goes into messages or logs. */
export function maskBankAccount(account: string): string {
  const trimmed = account.trim();
  return trimmed.length <= 4 ? '••••' : `••••${trimmed.slice(-4)}`;
}
