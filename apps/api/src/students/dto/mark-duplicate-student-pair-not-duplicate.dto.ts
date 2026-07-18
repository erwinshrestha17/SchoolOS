import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { MarkDuplicateStudentPairNotDuplicatePayload } from '@schoolos/core';

export class MarkDuplicateStudentPairNotDuplicateDto implements MarkDuplicateStudentPairNotDuplicatePayload {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentOneId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentTwoId!: string;

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
