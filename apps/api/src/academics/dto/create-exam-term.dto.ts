import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
  weightPercent?: number;
}
