import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { JournalLineSide } from '@prisma/client';

export class OpeningBalanceLineDto {
  @IsString()
  chartAccountId!: string;

  @IsEnum(JournalLineSide)
  side!: JournalLineSide;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateOpeningBalanceDto {
  @IsString()
  fiscalYearId!: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => OpeningBalanceLineDto)
  lines!: OpeningBalanceLineDto[];
}
