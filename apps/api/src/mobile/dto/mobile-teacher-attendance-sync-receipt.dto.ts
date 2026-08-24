import { ApiProperty } from '@nestjs/swagger';
import {
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
} from '@prisma/client';

export class MobileTeacherAttendanceSyncReceiptDto {
  @ApiProperty({ maxLength: 128 })
  clientSubmissionId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  attendanceSessionId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  conflictId!: string | null;

  @ApiProperty({ enum: AttendanceSyncStatus, enumName: 'AttendanceSyncStatus' })
  syncStatus!: AttendanceSyncStatus;

  @ApiProperty()
  replayed!: boolean;

  @ApiProperty({
    enum: AttendanceSyncRejectionReason,
    enumName: 'AttendanceSyncRejectionReason',
    nullable: true,
  })
  rejectionReason!: AttendanceSyncRejectionReason | null;

  @ApiProperty({ format: 'date-time' })
  serverReceivedAt!: string;
}
