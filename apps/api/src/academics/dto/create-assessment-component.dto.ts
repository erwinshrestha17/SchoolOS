import { AssessmentType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAssessmentComponentDto {
  @IsString()
  examTermId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsNumber()
  @Min(0)
  maxMarks!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;
}
