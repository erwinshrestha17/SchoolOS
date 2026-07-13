import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewStaffLeaveDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
