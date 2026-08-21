import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { RemoteLookupPage, StudentLookupOption } from '@schoolos/core';

export class ListStudentOptionsDto {
  @ApiProperty({ minLength: 2, maxLength: 80 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  search!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number = 25;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;
}

export class StudentLookupOptionResponseDto implements StudentLookupOption {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  studentSystemId!: string;

  @ApiProperty({ nullable: true })
  admissionNumber!: string | null;

  @ApiProperty()
  fullNameEn!: string;

  @ApiProperty({ format: 'uuid' })
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  sectionId!: string | null;

  @ApiProperty({ nullable: true })
  sectionName!: string | null;
}

export class StudentLookupPageResponseDto implements RemoteLookupPage<StudentLookupOption> {
  @ApiProperty({ type: [StudentLookupOptionResponseDto] })
  items!: StudentLookupOption[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;
}
