import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStaffContractDto {
  @IsString()
  staffId!: string;

  @IsString()
  contractNumber!: string;

  @IsString()
  position!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;
}
