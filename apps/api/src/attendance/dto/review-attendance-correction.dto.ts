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

  @ApiProperty({
    description:
      'Required school-facing reason for approving or rejecting the correction.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reviewReason?: string;
}
