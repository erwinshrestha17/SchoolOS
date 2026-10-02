import { LeaveDayPart } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

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

  /** Phase 7.6 (D5): FULL_DAY (default) or one half of a single day. */
  @IsOptional()
  @IsEnum(LeaveDayPart)
  dayPart?: LeaveDayPart;
}

export class CreateMyStaffLeaveRequestDto {
  @IsString()
  leaveType!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  reason!: string;

  /** Phase 7.6 (D5): FULL_DAY (default) or one half of a single day. */
  @IsOptional()
  @IsEnum(LeaveDayPart)
  dayPart?: LeaveDayPart;
}
