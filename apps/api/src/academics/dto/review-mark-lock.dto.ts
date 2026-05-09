import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewMarkLockDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
