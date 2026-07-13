import { IsString, MaxLength, MinLength } from 'class-validator';

export class CloseFiscalYearDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
