import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubmitAttendanceDto } from './submit-attendance.dto';

export class SyncAttendanceDto extends SubmitAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientSubmissionId!: string;

  @IsDateString()
  deviceTimestamp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionFingerprint?: string;

  /**
   * Teacher `scopeVersion` captured when the draft was created. When sent,
   * a mismatch with the current assignment fingerprint is `SCOPE_REVOKED`.
   * Omitted by current clients during the compatibility window.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  authorizationVersion?: string;

  /**
   * Opaque roster snapshot returned by the roster read used to create this
   * operation. Optional only for wire compatibility; the sync service rejects
   * a new operation without it before creating attendance records.
   */
  @ApiPropertyOptional({
    description:
      'Opaque SHA-256 roster snapshot precondition returned by the attendance roster endpoint.',
    pattern: '^[a-f0-9]{64}$',
    example: 'b58c09a2d0c9f23d3bfe84a64c9d3c924a0f5f70a3894c42d1280dca0a11e2e1',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  expectedRosterVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorityNodeId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  authorityEpoch?: number;
}
