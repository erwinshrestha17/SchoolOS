import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateBillingRunDto {
  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  feePlanId?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  runMonth!: number;

  @IsInt()
  @Min(2000)
  runYear!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
