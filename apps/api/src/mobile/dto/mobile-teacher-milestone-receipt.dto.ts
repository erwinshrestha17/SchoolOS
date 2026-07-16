import { ApiProperty } from '@nestjs/swagger';

export class MobileTeacherMilestoneReceiptDto {
  @ApiProperty({ format: 'uuid' })
  resourceId!: string;

  @ApiProperty({ format: 'uuid' })
  clientSubmissionId!: string;

  @ApiProperty()
  replayed!: boolean;

  @ApiProperty({ format: 'date-time' })
  serverReceivedAt!: string;
}
