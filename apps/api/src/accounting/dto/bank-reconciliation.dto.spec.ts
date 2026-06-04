import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ImportBankStatementDto,
  ReconcileBankStatementDto,
} from './import-bank-statement.dto';

describe('Bank reconciliation DTOs', () => {
  it('accepts valid bank statement import lines', () => {
    const dto = plainToInstance(ImportBankStatementDto, {
      lines: [
        {
          statementDate: '2026-04-01',
          description: 'School fee deposit',
          debitAmount: '1500.50',
        },
      ],
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.lines[0].debitAmount).toBe(1500.5);
  });

  it('rejects empty bank statement imports', () => {
    const dto = plainToInstance(ImportBankStatementDto, { lines: [] });

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'lines',
        }),
      ]),
    );
  });

  it('rejects missing reconciliation identifiers', () => {
    const dto = plainToInstance(ReconcileBankStatementDto, {
      statementId: '',
    });

    const errors = validateSync(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['statementId', 'journalLineId']),
    );
  });
});
