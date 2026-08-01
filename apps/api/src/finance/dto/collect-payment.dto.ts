import { PaymentMethod } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CollectPaymentAllocationDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount!: string;
}

export class CollectPaymentDto {
  /** Compatibility shortcut for one full invoice allocation. */
  @IsOptional()
  @IsString()
  invoiceId?: string;

  /** Required when recording an advance without an invoice. */
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CollectPaymentAllocationDto)
  allocations?: CollectPaymentAllocationDto[];

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  narration?: string;

  @IsOptional()
  @IsBoolean()
  isAdvance?: boolean;

  @IsOptional()
  @IsDateString()
  recognizedAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;
}
