import { IsDateString, IsString } from 'class-validator';

export class CreateFiscalYearDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
