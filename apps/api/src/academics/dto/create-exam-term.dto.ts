import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateExamTermDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  name!: string;

  @IsString()
  startsOn!: string;

  @IsString()
  endsOn!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
}
