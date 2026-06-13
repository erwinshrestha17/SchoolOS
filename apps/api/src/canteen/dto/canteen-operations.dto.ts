import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CanteenDateRangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class CloseCanteenStockDateDto {
  @IsDateString() date!: string;
  @IsString() reason!: string;
}

export class CanteenSupplierPurchaseReportDto extends CanteenDateRangeDto {
  @IsOptional() @IsString() supplierId?: string;
}
