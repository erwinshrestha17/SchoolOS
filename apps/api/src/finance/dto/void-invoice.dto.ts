import { IsOptional, IsString } from 'class-validator';

export class VoidInvoiceDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;
}
