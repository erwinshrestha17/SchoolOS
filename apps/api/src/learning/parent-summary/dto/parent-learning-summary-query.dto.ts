import { IsOptional, IsString } from 'class-validator';

export class ParentLearningSummaryQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;
}
