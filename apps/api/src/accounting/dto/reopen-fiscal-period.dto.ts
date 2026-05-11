import { IsString, MinLength } from 'class-validator';

export class ReopenFiscalPeriodDto {
  @IsString()
  @MinLength(5)
  reason: string;
}
