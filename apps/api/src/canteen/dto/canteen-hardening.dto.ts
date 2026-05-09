import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CanteenReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CanteenLowBalanceAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  windowKey?: string;
}
