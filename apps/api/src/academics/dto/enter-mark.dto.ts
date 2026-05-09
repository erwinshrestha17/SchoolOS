import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MarkEntryStatus } from '@prisma/client';

export class EnterMarkDto {
  @IsUUID()
  examTermId!: string;

  @IsUUID()
  assessmentComponentId!: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsEnum(MarkEntryStatus)
  status?: MarkEntryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
