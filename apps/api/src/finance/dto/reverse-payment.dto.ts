import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  idempotencyKey!: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}
