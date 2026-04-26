import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFeeWaiverDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  feeHeadId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  reason!: string;
}
