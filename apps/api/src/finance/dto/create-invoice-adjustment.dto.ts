import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum InvoiceAdjustmentDirection {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export class CreateInvoiceAdjustmentDto {
  @IsEnum(InvoiceAdjustmentDirection)
  direction!: InvoiceAdjustmentDirection;

  @IsString()
  feeHeadId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatAmount?: number;

  @IsString()
  reason!: string;
}
