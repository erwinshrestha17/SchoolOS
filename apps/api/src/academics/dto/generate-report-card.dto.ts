import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateReportCardDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  examTermId!: string;

  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsBoolean()
  lock?: boolean;
}
