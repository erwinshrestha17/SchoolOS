import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewMarkLockDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
