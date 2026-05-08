import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MarkEntryStatus } from '@prisma/client';

// Fallback for environment issues where prisma client isn't regenerated
export const MarkEntryStatusEnum = MarkEntryStatus || {
  SUBMITTED: 'SUBMITTED',
  ABSENT: 'ABSENT',
  WITHHELD: 'WITHHELD',
};

export class EnterMarkDto {
  @IsString()
  examTermId!: string;

  @IsString()
  assessmentComponentId!: string;

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
