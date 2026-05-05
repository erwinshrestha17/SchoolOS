import { AssessmentType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateAssessmentComponentDto {
  @IsOptional()
  @IsString()
  examTermId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  weightPercent?: number;
}
