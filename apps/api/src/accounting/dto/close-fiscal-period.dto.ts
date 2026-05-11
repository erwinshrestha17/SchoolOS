import { IsString, MinLength } from 'class-validator';

export class CloseFiscalPeriodDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
