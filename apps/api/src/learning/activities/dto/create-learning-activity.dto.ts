import {
  LearningAccessType,
  LearningActivityStatus,
  LearningActivityType,
  LearningDifficulty,
  LearningLanguageMode,
  LearningMode,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LearningQuestionDto } from './learning-question.dto';

export class CreateLearningActivityDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsEnum(LearningActivityType)
  activityType!: LearningActivityType;

  @IsEnum(LearningDifficulty)
  difficulty!: LearningDifficulty;

  @IsEnum(LearningMode)
  mode!: LearningMode;

  @IsOptional()
  @IsEnum(LearningAccessType)
  accessType?: LearningAccessType;

  @IsOptional()
  @IsEnum(LearningLanguageMode)
  languageMode?: LearningLanguageMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  estimatedMinutes?: number;

  @IsOptional()
  @IsEnum(LearningActivityStatus)
  status?: LearningActivityStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningQuestionDto)
  questions?: LearningQuestionDto[];
}
