import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewStaffLeaveRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
