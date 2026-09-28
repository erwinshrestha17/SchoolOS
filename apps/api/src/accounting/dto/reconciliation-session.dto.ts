import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PrepareReconciliationDto {
  @IsUUID()
  accountId!: string;

  @IsUUID()
  fiscalPeriodId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  statementFrom!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  statementTo!: string;

  @Matches(/^-?\d{1,16}(\.\d{1,2})?$/)
  openingBankBalance!: string;

  @Matches(/^-?\d{1,16}(\.\d{1,2})?$/)
  closingBankBalance!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(240)
  statementReference!: string;
}
export class ReconciliationReasonDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class AmendReconciliationDto extends ReconciliationReasonDto {
  @Matches(/^-?\d{1,16}(\.\d{1,2})?$/)
  openingBankBalance!: string;

  @Matches(/^-?\d{1,16}(\.\d{1,2})?$/)
  closingBankBalance!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(240)
  statementReference!: string;
}
