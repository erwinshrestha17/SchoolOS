import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateMarkDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number | null;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsBoolean()
  isWithheld?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}
