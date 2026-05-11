import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class LegacySubmitHomeworkDto {
  @IsString()
  submissionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class LegacyReviewHomeworkSubmissionDto {
  @IsString()
  submissionId!: string;

  @IsString()
  status!: string;

  @IsOptional()
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  feedback?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  teacherRemarks?: string;
}
