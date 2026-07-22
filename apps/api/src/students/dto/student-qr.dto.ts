import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  STUDENT_QR_REASON_MAX_LENGTH,
  STUDENT_QR_REASON_MIN_LENGTH,
  StudentQrResolvePurpose,
} from '@schoolos/core';

export class ResolveStudentQrDto {
  @ApiProperty({
    example: 'scanned-token',
    description: 'The raw token from the QR code',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    enum: StudentQrResolvePurpose,
    description: 'The purpose for which the QR is being resolved',
  })
  @IsEnum(StudentQrResolvePurpose)
  @IsNotEmpty()
  purpose!: StudentQrResolvePurpose;
}

export class RotateStudentQrDto {
  @ApiProperty({
    description: 'Reason for rotating the QR credential',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(STUDENT_QR_REASON_MIN_LENGTH)
  @MaxLength(STUDENT_QR_REASON_MAX_LENGTH)
  reason!: string;
}

export class RevokeStudentQrDto {
  @ApiProperty({
    description: 'Reason for revoking the QR credential',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(STUDENT_QR_REASON_MIN_LENGTH)
  @MaxLength(STUDENT_QR_REASON_MAX_LENGTH)
  reason!: string;
}

export class StudentQrCredentialResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty({ enum: ['ACTIVE', 'ROTATED', 'REVOKED'] })
  status!: 'ACTIVE' | 'ROTATED' | 'REVOKED';

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  expiresAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  rotatedAt!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  revokedAt!: string | null;

  @ApiProperty({ nullable: true })
  rotateReason!: string | null;

  @ApiProperty({ nullable: true })
  revokeReason!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  lastScannedAt!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Protected File Registry asset identifier',
  })
  fileAssetId!: string | null;
}

export class StudentCredentialArtifactResponseDto {
  @ApiProperty({ type: StudentQrCredentialResponseDto })
  credential!: StudentQrCredentialResponseDto;

  @ApiProperty({
    nullable: true,
    description: 'Protected File Registry asset identifier',
  })
  fileAssetId!: string | null;

  @ApiProperty({ nullable: true })
  fileName!: string | null;

  @ApiProperty()
  fileAvailable!: boolean;

  @ApiPropertyOptional()
  fileMessage?: string;
}

export class StudentQrStatusHistoryResponseDto {
  @ApiProperty({ type: StudentQrCredentialResponseDto, nullable: true })
  activeCredential!: StudentQrCredentialResponseDto | null;

  @ApiProperty({ type: [StudentQrCredentialResponseDto] })
  history!: StudentQrCredentialResponseDto[];
}

export class StudentQrWorkspacePeriodResponseDto {
  @ApiProperty({ example: '2083-04-06' })
  bsDate!: string;

  @ApiProperty({ format: 'date-time' })
  startUtc!: string;

  @ApiProperty({ format: 'date-time' })
  endExclusiveUtc!: string;

  @ApiProperty({ enum: ['Asia/Kathmandu'] })
  timeZone!: 'Asia/Kathmandu';
}

export class StudentQrWorkspaceSummaryResponseDto {
  @ApiProperty()
  activeCredentials!: number;

  @ApiProperty()
  replacementFilesNeeded!: number;

  @ApiProperty()
  inactiveCredentials!: number;

  @ApiProperty()
  successfulScansToday!: number;

  @ApiProperty({ type: StudentQrWorkspacePeriodResponseDto })
  period!: StudentQrWorkspacePeriodResponseDto;
}
