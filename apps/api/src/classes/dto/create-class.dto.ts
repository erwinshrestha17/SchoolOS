import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_SUPPORTED_CLASS_LEVEL,
  MIN_SUPPORTED_CLASS_LEVEL,
} from '@schoolos/core';

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 11 Science', maxLength: 100 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 11,
    minimum: MIN_SUPPORTED_CLASS_LEVEL,
    maximum: MAX_SUPPORTED_CLASS_LEVEL,
    description: 'Supported school grade level from 1 through 12.',
  })
  @IsInt()
  @Min(MIN_SUPPORTED_CLASS_LEVEL)
  @Max(MAX_SUPPORTED_CLASS_LEVEL)
  level!: number;
}
