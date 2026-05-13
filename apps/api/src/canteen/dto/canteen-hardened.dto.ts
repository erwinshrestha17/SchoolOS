import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CanteenReversalDto {
  @IsString() reason!: string;
}

export class CanteenCorrectionDto {
  @IsNumber() @Min(1) amount!: number;
  @IsString() reason!: string;
}

export class OverrideAllergyDto {
  @IsString() reason!: string;
}

export class CreateCanteenSupplierDto {
  @IsString() name!: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() panNumber?: string;
}

export class CreateCanteenInventoryItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsString() category!: string;
  @IsString() unit!: string;
  @IsOptional() @IsNumber() @Min(0) minStockLevel?: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() defaultSupplierId?: string;
}

export class CreateCanteenPurchaseBillItemDto {
  @IsString() inventoryItemId!: string;
  @IsNumber() @Min(0.01) quantity!: number;
  @IsNumber() @Min(0.01) unitCost!: number;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() batchNumber?: string;
}

export class CreateCanteenPurchaseBillDto {
  @IsString() supplierId!: string;
  @IsString() billNumber!: string;
  @IsDateString() billDate!: string;
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCanteenPurchaseBillItemDto)
  items!: CreateCanteenPurchaseBillItemDto[];
}

export class CreateCanteenWastageDto {
  @IsString() inventoryItemId!: string;
  @IsNumber() @Min(0.01) quantity!: number;
  @IsString() reason!: string;
  @IsDateString() wastageDate!: string;
  @IsOptional() @IsString() notes?: string;
}

export class ManualStockAdjustmentDto {
  @IsString() inventoryItemId!: string;
  @IsNumber() quantity!: number; // Can be negative for manual out
  @IsString() reason!: string;
}
