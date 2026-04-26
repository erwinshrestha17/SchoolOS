import { HomeworkStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReviewHomeworkSubmissionDto {
  @IsString()
  submissionId!: string;

  @IsEnum(HomeworkStatus)
  status!: HomeworkStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
