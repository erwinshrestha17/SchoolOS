import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateFiscalBudgetDto {
  @IsUUID()
  fiscalYearId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
