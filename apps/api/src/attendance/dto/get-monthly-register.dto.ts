import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month!: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  year!: number;
}
