import { IsIn, IsOptional, IsString } from 'class-validator';

export class RecordTransportEmergencyContactDto {
  @IsString()
  studentId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsIn(['CALL', 'SMS', 'IN_APP_NOTE'])
  channel?: 'CALL' | 'SMS' | 'IN_APP_NOTE';
}
