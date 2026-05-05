import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  hasPractical?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  theoryMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  practicalMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;
}
