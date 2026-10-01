import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

class MarkSheetTransitionBaseDto {
  @ApiProperty({ description: 'MarkSheet.version the client last saw.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({
    description:
      'Client-generated key; a retry with the same key returns the original outcome.',
  })
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN)
  idempotencyKey!: string;
}

export class SubmitMarkSheetDto extends MarkSheetTransitionBaseDto {}

export class ReviewMarkSheetDto extends MarkSheetTransitionBaseDto {
  @ApiProperty({ enum: ['RETURN', 'REVIEW', 'LOCK'] })
  @IsIn(['RETURN', 'REVIEW', 'LOCK'])
  action!: 'RETURN' | 'REVIEW' | 'LOCK';

  @ApiPropertyOptional({ description: 'Required when returning a sheet.' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reason?: string;
}

export class UnlockMarkSheetDto extends MarkSheetTransitionBaseDto {
  @ApiProperty()
  @IsString()
  @Length(10, 1000)
  reason!: string;
}

export class ListMarkSheetsDto {
  @ApiProperty()
  @IsString()
  examTermId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentComponentId?: string;

  @ApiPropertyOptional({
    enum: [
      'DRAFT',
      'SUBMITTED',
      'RETURNED',
      'RESUBMITTED',
      'REVIEWED',
      'LOCKED',
    ],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'RETURNED', 'RESUBMITTED', 'REVIEWED', 'LOCKED'])
  status?: string;
}
