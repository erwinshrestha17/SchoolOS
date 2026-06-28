import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetMonthlyRegisterDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  academicYearId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  classId!: string;

  @ApiProperty()
  @IsUUID()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({
    description:
      'Legacy Gregorian month. Use bsMonth with bsYear for school-facing requests.',
  })
  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  month?: number;

  @ApiPropertyOptional({
    description:
      'Legacy Gregorian year. Use bsYear with bsMonth for school-facing requests.',
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({
    description:
      'Bikram Sambat month used by school-facing attendance registers.',
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  bsMonth?: number;

  @ApiPropertyOptional({
    description:
      'Bikram Sambat year used by school-facing attendance registers.',
    minimum: 2000,
    maximum: 2090,
  })
  @IsNumber()
  @Min(2000)
  @Max(2090)
  @IsOptional()
  @Type(() => Number)
  bsYear?: number;
}
