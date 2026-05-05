import { IsBoolean, IsOptional, IsString, IsArray } from 'class-validator';

export class BatchGenerateReportCardsDto {
  @IsString()
  academicYearId!: string;

  @IsString()
  examTermId!: string;

  @IsArray()
  @IsString({ each: true })
  studentIds!: string[];

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsBoolean()
  lock?: boolean;
}
