import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishResultsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reportCardIds?: string[];

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  examTermId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;
}
