import { IsString, MinLength } from 'class-validator';

export class UnlockFiscalPeriodDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
