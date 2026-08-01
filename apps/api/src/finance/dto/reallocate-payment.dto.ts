import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDecimal,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReallocatePaymentTargetDto {
  @IsUUID()
  invoiceId!: string;

  @IsDecimal({ decimal_digits: '1,2', force_decimal: false })
  amount!: string;
}

export class ReallocatePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReallocatePaymentTargetDto)
  allocations!: ReallocatePaymentTargetDto[];
}
