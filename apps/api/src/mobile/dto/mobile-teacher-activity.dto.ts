import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CreateActivityPostDto } from '../../activity-feed/dto/create-activity-post.dto';
import { DevelopmentalMilestoneStatus } from '@prisma/client';

export class CreateMobileTeacherActivityPostDto extends CreateActivityPostDto {
  @IsUUID()
  declare clientSubmissionId: string;
}

export class CreateMobileTeacherMilestoneDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsUUID()
  studentId!: string;

  @IsString()
  @MaxLength(80)
  domain!: string;

  @IsString()
  @MaxLength(240)
  milestone!: string;

  @IsEnum(DevelopmentalMilestoneStatus)
  status!: DevelopmentalMilestoneStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observationNote?: string;

  @IsDateString()
  observedAt!: string;
}

export class MobileTeacherActivityStudentsQueryDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class MobileTeacherActivityPostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
