import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class EnterMarkDto {
  @IsString()
  examTermId!: string;

  @IsString()
  assessmentComponentId!: string;

  @IsString()
  studentId!: string;

  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
