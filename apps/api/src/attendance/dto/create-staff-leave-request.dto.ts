import { IsDateString, IsString } from 'class-validator';

export class CreateStaffLeaveRequestDto {
  @IsString()
  staffId!: string;

  @IsString()
  leaveType!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  reason!: string;
}
