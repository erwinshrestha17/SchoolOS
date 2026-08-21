import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { RemoteLookupPage, StaffLookupOption } from '@schoolos/core';

export class ListStaffOptionsDto {
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
}

export class StaffLookupOptionResponseDto implements StaffLookupOption {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty({ nullable: true })
  staffCode!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true })
  department!: string | null;

  @ApiProperty({ nullable: true })
  designation!: string | null;
}

export class StaffLookupPageResponseDto implements RemoteLookupPage<StaffLookupOption> {
  @ApiProperty({ type: [StaffLookupOptionResponseDto] })
  items!: StaffLookupOption[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;
}
