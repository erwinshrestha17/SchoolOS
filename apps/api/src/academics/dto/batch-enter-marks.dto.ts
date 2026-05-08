import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MarkEntryStatus } from '@prisma/client';

export const MarkEntryStatusEnum = MarkEntryStatus || {
  SUBMITTED: 'SUBMITTED',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
};

class MarkEntryItem {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsEnum(['SUBMITTED', 'ABSENT', 'WITHHELD'])
  status?: MarkEntryStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BatchEnterMarksDto {
  @IsString()
  examTermId!: string;

  @IsString()
  assessmentComponentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkEntryItem)
  @ArrayMinSize(1)
  entries!: MarkEntryItem[];
}
