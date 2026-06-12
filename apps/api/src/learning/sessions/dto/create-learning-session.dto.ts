import { LearningMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateLearningSessionDto {
  @IsOptional()
  @IsEnum(LearningMode)
  mode?: LearningMode;

  @IsOptional()
  @IsBoolean()
  schoolOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  expiresInMinutes?: number;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
