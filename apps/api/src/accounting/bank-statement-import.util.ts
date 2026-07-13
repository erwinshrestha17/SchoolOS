import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { ImportBankStatementLineDto } from './dto/import-bank-statement.dto';

export type NormalizedBankStatementImportLine = {
  statementDate: Date;
  description: string;
  reference: string | null;
  debitAmount: Prisma.Decimal;
  creditAmount: Prisma.Decimal;
};

export function bankStatementImportLineKey(
  line: NormalizedBankStatementImportLine,
) {
  return JSON.stringify([
    line.statementDate.toISOString().slice(0, 10),
    line.description,
    line.reference,
    line.debitAmount.toFixed(2),
    line.creditAmount.toFixed(2),
  ]);
}

export function bankStatementImportFingerprint(
  accountId: string,
  lines: NormalizedBankStatementImportLine[],
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        accountId,
        rows: lines.map(bankStatementImportLineKey).sort(),
      }),
    )
    .digest('hex');
}

export function validateBankStatementImportLines(
  lines: ImportBankStatementLineDto[],
): NormalizedBankStatementImportLine[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new BadRequestException(
      'Bank statement import requires at least one line',
    );
  }

  const seenRows = new Set<string>();
  return lines.map((line, index) => {
    const description = line.description?.trim();
    const statementDate = new Date(line.statementDate);
    const debitAmount = line.debitAmount ?? 0;
    const creditAmount = line.creditAmount ?? 0;

    if (!description) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} requires a description`,
      );
    }

    if (Number.isNaN(statementDate.getTime())) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} has an invalid statement date`,
      );
    }

    if (debitAmount < 0 || creditAmount < 0) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} cannot have negative amounts`,
      );
    }

    if (debitAmount === 0 && creditAmount === 0) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} requires a debit or credit amount`,
      );
    }

    if (debitAmount > 0 && creditAmount > 0) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} cannot include both debit and credit amounts`,
      );
    }

    const normalized = {
      statementDate,
      description,
      reference: line.reference?.trim() || null,
      debitAmount: new Prisma.Decimal(debitAmount),
      creditAmount: new Prisma.Decimal(creditAmount),
    };
    const rowKey = bankStatementImportLineKey(normalized);
    if (seenRows.has(rowKey)) {
      throw new BadRequestException(
        `Bank statement line ${index + 1} duplicates another row in this import`,
      );
    }
    seenRows.add(rowKey);
    return normalized;
  });
}
