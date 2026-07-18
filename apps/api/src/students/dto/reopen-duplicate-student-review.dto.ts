import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { ReopenDuplicateStudentReviewPayload } from '@schoolos/core';
import { ApiProperty } from '@nestjs/swagger';

export class ReopenDuplicateStudentReviewDto implements ReopenDuplicateStudentReviewPayload {
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
