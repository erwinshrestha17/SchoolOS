import { DevelopmentalMilestoneStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDevelopmentalMilestoneDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  studentId!: string;

  @IsString()
  domain!: string;

  @IsString()
  milestone!: string;

  @IsEnum(DevelopmentalMilestoneStatus)
  status!: DevelopmentalMilestoneStatus;

  @IsOptional()
  @IsString()
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
