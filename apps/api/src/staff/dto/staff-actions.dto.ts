import { StaffDocumentKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AddStaffDocumentDto {
  @IsEnum(StaffDocumentKind)
  kind!: StaffDocumentKind;

  @IsUUID()
  fileId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyStaffDocumentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TerminateStaffDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  effectiveDate?: string;
}

export class ContractExpiryReminderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  days?: number;
}

export class CreateStaffLeaveRequestDto {
  @IsIn([
    'SICK',
    'CASUAL',
    'EARNED',
    'MATERNITY',
    'PATERNITY',
    'UNPAID',
    'OTHER',
  ])
  leaveType!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ReviewStaffLeaveRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class RecordStaffAttendanceDto {
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @IsOptional()
  @IsIn([
    'PRESENT',
    'ABSENT',
    'LATE',
    'HALF_DAY',
    'LEAVE',
    'ON_LEAVE',
    'HOLIDAY',
    'SICK_LEAVE',
    'EXCUSED_LEAVE',
    'UNEXCUSED_LEAVE',
  ])
  status?: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ProcessAccrualsDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
