import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateExamTermDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;

  @IsOptional()
  @IsString()
  status?: any;
}
