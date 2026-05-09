import { IsString, MinLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
