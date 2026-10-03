import { Type } from 'class-transformer';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StaffAttendanceCorrectionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
export class StaffAttendanceCorrectionDecisionDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
export class StaffAttendanceImpactQueryDto {
  @ApiPropertyOptional({
    default: 30,
    description:
      'Provisional working-day assumption, matching payroll preparation default',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  workingDays = 30;
}

export class StaffAttendanceCorrectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() attendanceId!: string;
  @ApiProperty() staffId!: string;
  @ApiProperty({ format: 'date-time' }) attendanceDate!: Date;
  @ApiProperty() originalStatus!: string;
  @ApiProperty() requestedStatus!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  originalCheckInAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  requestedCheckInAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  originalCheckOutAt!: Date | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  requestedCheckOutAt!: Date | null;
  @ApiProperty() reason!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty({ type: String, nullable: true }) approverId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  decidedAt!: Date | null;
  @ApiProperty({
    enum: [
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'PENDING_PAYROLL_ADJUSTMENT',
    ],
  })
  status!: string;
}
export class StaffAttendanceCorrectionPageResponseDto {
  @ApiProperty({ type: [StaffAttendanceCorrectionResponseDto] })
  items!: StaffAttendanceCorrectionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
export class StaffAttendanceCorrectionImpactResponseDto {
  @ApiProperty() correctionId!: string;
  @ApiProperty() workingDays!: number;
  @ApiProperty() paidDaysDelta!: number;
  @ApiProperty() unpaidDaysDelta!: number;
  @ApiProperty() payrollLocked!: boolean;
  @ApiProperty({ enum: ['CURRENT_PAYROLL_DAY_RULES'] }) basis!: string;
  @ApiProperty() provisional!: boolean;
}
