import { DevelopmentalMilestoneStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDevelopmentalMilestoneDto {
  @IsOptional()
  @IsUUID()
  clientSubmissionId?: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  studentId!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(80)
  domain!: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(240)
  milestone!: string;

  @IsEnum(DevelopmentalMilestoneStatus)
  status!: DevelopmentalMilestoneStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observationNote?: string;

  @IsOptional()
  @IsString()
  photoObjectKey?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsDateString()
  observedAt!: string;
}
