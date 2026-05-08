import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MarkEntryStatus } from '@prisma/client';

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
  @IsEnum(MarkEntryStatus)
  status?: MarkEntryStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
