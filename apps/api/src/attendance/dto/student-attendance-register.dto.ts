import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const MONTH_STATES = [
  'COMPLETED',
  'CURRENT',
  'UPCOMING',
  'NO_DATA',
  'PARTIAL',
] as const;

export class StudentAttendanceMonthQueryDto {
  @ApiPropertyOptional({
    description:
      'Student enrollment academic year. When omitted, the current or latest enrolled year is selected.',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({
    description:
      'Bikram Sambat month key. When omitted, the current month is selected for the current year and the last available month for a completed historical year.',
    example: '2083-03',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

export class StudentAttendanceAcademicYearOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '2083-01-01' })
  startsOnBs!: string;

  @ApiProperty({ example: '2083-12-30' })
  endsOnBs!: string;

  @ApiProperty()
  isCurrent!: boolean;
}

export class StudentAttendanceMonthOptionResponseDto {
  @ApiProperty({ example: '2083-03' })
  key!: string;

  @ApiProperty({ example: 'Asar 2083 BS' })
  label!: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  bsMonth!: number;

  @ApiProperty()
  bsYear!: number;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty()
  isAvailable!: boolean;
}

export class StudentAttendanceTotalsResponseDto {
  @ApiProperty()
  totalSchoolDays!: number;

  @ApiProperty()
  present!: number;

  @ApiProperty()
  absent!: number;

  @ApiProperty()
  late!: number;

  @ApiProperty()
  leave!: number;

  @ApiProperty()
  recordedDays!: number;

  @ApiProperty({ nullable: true, type: Number })
  attendancePercentage!: number | null;
}

export class StudentAttendanceMonthSummaryResponseDto extends StudentAttendanceTotalsResponseDto {
  @ApiProperty({ example: '2083-03' })
  key!: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  bsMonth!: number;

  @ApiProperty()
  bsYear!: number;

  @ApiProperty({ example: 'Asar 2083 BS' })
  label!: string;

  @ApiProperty({ example: '2083-03-01' })
  startsOnBs!: string;

  @ApiProperty({ example: '2083-03-31' })
  endsOnBs!: string;

  @ApiProperty({ enum: MONTH_STATES })
  state!: (typeof MONTH_STATES)[number];

  @ApiProperty()
  registerDays!: number;
}

export class StudentAttendanceMonthlyRegisterDayResponseDto {
  @ApiProperty({ example: '2083-03-28' })
  dateBs!: string;

  @ApiProperty({ example: 'Asar 28, 2083' })
  dateLabel!: string;

  @ApiProperty({ example: 'Sunday' })
  dayLabel!: string;

  @ApiProperty({ minimum: 0, maximum: 6, description: 'Sunday = 0' })
  weekday!: number;

  @ApiProperty({ enum: ['SCHOOL_DAY', 'HOLIDAY', 'WEEKEND', 'EXAM_DAY'] })
  dayType!: 'SCHOOL_DAY' | 'HOLIDAY' | 'WEEKEND' | 'EXAM_DAY';

  @ApiProperty({ nullable: true, type: String })
  calendarLabel!: string | null;

  @ApiProperty({ nullable: true, type: String })
  holidayName!: string | null;

  @ApiProperty({ enum: ['SUBMITTED', 'DRAFT', 'NOT_CREATED'] })
  registerState!: 'SUBMITTED' | 'DRAFT' | 'NOT_CREATED';

  @ApiProperty({ nullable: true, type: String })
  attendanceStatus!: string | null;

  @ApiProperty()
  isToday!: boolean;

  @ApiProperty()
  isFuture!: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  arrivalAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  remark!: string | null;
}

export class StudentAttendanceMonthlyRegisterResponseDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty({ type: [StudentAttendanceAcademicYearOptionResponseDto] })
  academicYears!: StudentAttendanceAcademicYearOptionResponseDto[];

  @ApiProperty({
    type: StudentAttendanceAcademicYearOptionResponseDto,
    nullable: true,
  })
  selectedAcademicYear!: StudentAttendanceAcademicYearOptionResponseDto | null;

  @ApiProperty({ type: [StudentAttendanceMonthOptionResponseDto] })
  months!: StudentAttendanceMonthOptionResponseDto[];

  @ApiProperty({ nullable: true, type: String, example: '2083-03' })
  currentMonthKey!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '2083-02' })
  previousMonthKey!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '2083-04' })
  nextMonthKey!: string | null;

  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE'] })
  calendarState!: 'AVAILABLE' | 'UNAVAILABLE';

  @ApiProperty({ enum: ['COMPLETE', 'PARTIAL', 'EMPTY'] })
  dataState!: 'COMPLETE' | 'PARTIAL' | 'EMPTY';

  @ApiProperty({
    type: StudentAttendanceMonthSummaryResponseDto,
    nullable: true,
  })
  month!: StudentAttendanceMonthSummaryResponseDto | null;

  @ApiProperty()
  leaveSupported!: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastUpdatedAt!: string | null;

  @ApiProperty({ type: [StudentAttendanceMonthlyRegisterDayResponseDto] })
  days!: StudentAttendanceMonthlyRegisterDayResponseDto[];
}
