import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumberString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class FiscalBudgetLineInputDto {
  @IsUUID()
  chartAccountId!: string;

  @IsOptional()
  @IsUUID()
  fiscalPeriodId?: string;

  @IsNumberString()
  amount!: string;
}

export class UpsertFiscalBudgetLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FiscalBudgetLineInputDto)
  lines!: FiscalBudgetLineInputDto[];
}
