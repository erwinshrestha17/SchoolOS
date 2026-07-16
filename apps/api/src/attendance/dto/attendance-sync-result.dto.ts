import { ApiProperty } from '@nestjs/swagger';
import {
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
} from '@prisma/client';

export class AttendanceSyncResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ maxLength: 128 })
  clientSubmissionId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  attendanceSessionId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  conflictId!: string | null;

  @ApiProperty({ enum: AttendanceSyncStatus, enumName: 'AttendanceSyncStatus' })
  syncStatus!: AttendanceSyncStatus;

  @ApiProperty({ format: 'date-time' })
  attendanceDate!: string;

  @ApiProperty({ nullable: true })
  deviceId!: string | null;

  @ApiProperty({ nullable: true })
  deviceLabel!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  deviceTimestamp!: string | null;

  @ApiProperty({ nullable: true })
  sessionFingerprint!: string | null;

  @ApiProperty({ minimum: 1 })
  syncAttemptCount!: number;

  @ApiProperty({ format: 'date-time' })
  serverReceivedAt!: string;

  @ApiProperty()
  replayed!: boolean;

  @ApiProperty({
    enum: AttendanceSyncRejectionReason,
    enumName: 'AttendanceSyncRejectionReason',
    nullable: true,
  })
  rejectionReason!: AttendanceSyncRejectionReason | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
