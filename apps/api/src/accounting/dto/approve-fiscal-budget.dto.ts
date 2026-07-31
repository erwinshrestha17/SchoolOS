import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveFiscalBudgetDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
