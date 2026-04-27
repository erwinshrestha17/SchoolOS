import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalLineSide } from '@prisma/client';

class ManualJournalLineDto {
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

export class CreateManualJournalDto {
  @IsDateString()
  entryDate!: string;

  @IsString()
  narration!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ManualJournalLineDto)
  lines!: ManualJournalLineDto[];
}
