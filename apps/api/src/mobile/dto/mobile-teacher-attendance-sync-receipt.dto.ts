import { ApiProperty } from '@nestjs/swagger';
import { AttendanceSyncStatus } from '@prisma/client';

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

  @ApiProperty({ format: 'date-time' })
  serverReceivedAt!: string;
}
