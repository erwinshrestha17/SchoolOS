import { ApiProperty } from '@nestjs/swagger';

const READINESS_STATUSES = [
  'READY',
  'READY_WITH_WARNINGS',
  'BLOCKED',
  'NOT_EVALUATED',
  'OUTDATED_VALIDATION',
] as const;

const ISSUE_SEVERITIES = [
  'BLOCKING',
  'WARNING',
  'INFORMATION',
  'NOT_REQUIRED',
] as const;

const ISSUE_CATEGORIES = [
  'IDENTITY',
  'ENROLLMENT_PLACEMENT',
  'GUARDIAN_INFORMATION',
  'TRANSFER_INFORMATION',
  'DOCUMENTS',
  'ATTENDANCE',
  'ACADEMIC_STATUS_RESULTS',
] as const;

const FIX_TARGETS = [
  'STUDENT_PROFILE',
  'ENROLLMENT',
  'GUARDIANS',
  'DOCUMENTS',
  'ATTENDANCE',
  'ACADEMICS',
  'NONE',
] as const;

export class StudentIemisReadinessIssueResponseDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: ISSUE_CATEGORIES })
  category!: (typeof ISSUE_CATEGORIES)[number];

  @ApiProperty({ enum: ISSUE_SEVERITIES })
  severity!: (typeof ISSUE_SEVERITIES)[number];

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  field!: string;

  @ApiProperty()
  blocking!: boolean;

  @ApiProperty({ nullable: true })
  currentValueSafe!: string | null;

  @ApiProperty()
  requiredAction!: string;

  @ApiProperty({ enum: FIX_TARGETS })
  fixTarget!: (typeof FIX_TARGETS)[number];

  @ApiProperty({ nullable: true })
  requiredPermission!: string | null;

  @ApiProperty({ nullable: true })
  responsibleRole!: string | null;
}

export class StudentIemisReadinessResponseDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentSystemId!: string;

  @ApiProperty()
  fullNameEn!: string;

  @ApiProperty({ nullable: true })
  nationalStudentId!: string | null;

  @ApiProperty({ enum: READINESS_STATUSES })
  status!: (typeof READINESS_STATUSES)[number];

  @ApiProperty()
  passedRequiredChecks!: number;

  @ApiProperty()
  totalRequiredChecks!: number;

  @ApiProperty()
  blockingIssueCount!: number;

  @ApiProperty()
  warningCount!: number;

  @ApiProperty()
  exportEligible!: boolean;

  @ApiProperty({
    description: 'Compatibility alias for exportEligible.',
  })
  eligible!: boolean;

  @ApiProperty({ format: 'date-time' })
  evaluatedAt!: string;

  @ApiProperty()
  requirementVersion!: string;

  @ApiProperty({
    description:
      'Secondary readiness percentage derived from required-check counts.',
  })
  score!: number;

  @ApiProperty({ nullable: true })
  academicYear!: string | null;

  @ApiProperty({ nullable: true })
  className!: string | null;

  @ApiProperty({ nullable: true })
  sectionName!: string | null;

  @ApiProperty({ nullable: true })
  rollNumber!: number | null;

  @ApiProperty({ nullable: true })
  enrollmentStatus!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  admissionDate!: string | null;

  @ApiProperty({ type: [StudentIemisReadinessIssueResponseDto] })
  issues!: StudentIemisReadinessIssueResponseDto[];
}
