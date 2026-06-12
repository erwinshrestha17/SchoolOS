import {
  LearningActivityStatus,
  LearningDifficulty,
  LearningMode,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListLearningActivitiesDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsEnum(LearningDifficulty)
  difficulty?: LearningDifficulty;

  @IsOptional()
  @IsEnum(LearningMode)
  mode?: LearningMode;

  @IsOptional()
  @IsEnum(LearningActivityStatus)
  status?: LearningActivityStatus;

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
