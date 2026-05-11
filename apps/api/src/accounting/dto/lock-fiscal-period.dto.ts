import { IsString, MinLength } from 'class-validator';

export class LockFiscalPeriodDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
