import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReopenFiscalPeriodDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey?: string;
}
