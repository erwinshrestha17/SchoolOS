import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AssessmentRetakeResultDecision,
  AssessmentRetakeStatus,
  AssessmentRetakeType,
} from '@prisma/client';

export class ListAssessmentRetakesDto {
  @IsOptional()
  @IsEnum(AssessmentRetakeStatus)
  status?: AssessmentRetakeStatus;

  @IsOptional()
  @IsEnum(AssessmentRetakeType)
  type?: AssessmentRetakeType;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  examTermId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateAssessmentRetakeDto {
  @IsString()
  markEntryId!: string;

  @IsEnum(AssessmentRetakeType)
  type!: AssessmentRetakeType;

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class ApproveAssessmentRetakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class RejectAssessmentRetakeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reviewNote!: string;
}

export class ScheduleAssessmentRetakeDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  room?: string;
}

export class CompleteAssessmentRetakeDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  marksObtained!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class ApplyAssessmentRetakeResultDto {
  @IsIn([
    AssessmentRetakeResultDecision.KEEP_ORIGINAL,
    AssessmentRetakeResultDecision.USE_RETAKE,
  ])
  decision!:
    | typeof AssessmentRetakeResultDecision.KEEP_ORIGINAL
    | typeof AssessmentRetakeResultDecision.USE_RETAKE;

  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class CancelAssessmentRetakeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
