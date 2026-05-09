import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewAttendanceCorrectionDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  @IsNotEmpty()
  status!: 'APPROVED' | 'REJECTED';

  @ApiProperty()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reviewNote?: string;
}
