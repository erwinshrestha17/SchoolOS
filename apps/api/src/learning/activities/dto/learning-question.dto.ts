import { LearningQuestionType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LearningQuestionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(LearningQuestionType)
  type!: LearningQuestionType;

  @IsString()
  @MaxLength(5000)
  prompt!: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  correctAnswer?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  metadata?: unknown;
}
