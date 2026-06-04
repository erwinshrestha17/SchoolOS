import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportBankStatementLineDto {
  @IsDateString()
  statementDate!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => ImportBankStatementLineDto)
  lines!: ImportBankStatementLineDto[];
}

export class ReconcileBankStatementDto {
  @IsString()
  @IsNotEmpty()
  statementId!: string;

  @IsString()
  @IsNotEmpty()
  journalLineId!: string;
}
