import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportBankStatementLineDto {
  @IsDateString()
  statementDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditAmount?: number;
}

export class ImportBankStatementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportBankStatementLineDto)
  lines!: ImportBankStatementLineDto[];

  @IsOptional()
  @IsString()
  @Length(64, 64)
  fingerprint?: string;
}

export class ReconcileBankStatementDto {
  @IsString()
  @IsNotEmpty()
  statementId!: string;

  @IsString()
  @IsNotEmpty()
  journalLineId!: string;
}

export class UnreconcileBankStatementDto {
  @IsString()
  @IsNotEmpty()
  statementId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
