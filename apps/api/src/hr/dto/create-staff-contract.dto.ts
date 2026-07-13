import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStaffContractDto {
  @IsUUID()
  staffId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/\S/, { message: 'contractNumber cannot be blank' })
  contractNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/, { message: 'position cannot be blank' })
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
