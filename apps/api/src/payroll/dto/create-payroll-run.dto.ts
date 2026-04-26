import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePayrollRunDto {
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsInt()
  @Min(2000)
  periodYear!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  workingDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
