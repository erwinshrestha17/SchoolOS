import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class HomeworkSummaryQueryDto {
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class HomeworkWorkloadQueryDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}
