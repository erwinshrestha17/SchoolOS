import { ApiProperty } from '@nestjs/swagger';

const IEMIS_ARTIFACT_STATUSES = [
  'BLOCKED_CONFIGURATION',
  'REQUIRES_AUTHORIZED_REVIEW',
] as const;

export class IemisExportIssueResponseDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentSystemId!: string;

  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class IemisExportConfigurationIssueResponseDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  blocking!: boolean;
}

export class IemisExportResponseDto {
  @ApiProperty({ example: 'SCHOLOS-IEMIS-1.0' })
  formatVersion!: 'SCHOLOS-IEMIS-1.0';

  @ApiProperty({ example: 'REPORTING_READINESS_HANDOFF' })
  artifactPurpose!: 'REPORTING_READINESS_HANDOFF';

  @ApiProperty({ example: 'SCHOOL_OS_INTERNAL_RULE_SET' })
  schemaAuthority!: 'SCHOOL_OS_INTERNAL_RULE_SET';

  @ApiProperty({ example: false })
  officialFormatVerified!: boolean;

  @ApiProperty({ example: false })
  directSubmissionSupported!: boolean;

  @ApiProperty({ example: true })
  requiresAuthorizedReview!: boolean;

  @ApiProperty({ enum: IEMIS_ARTIFACT_STATUSES })
  artifactStatus!: (typeof IEMIS_ARTIFACT_STATUSES)[number];

  @ApiProperty({ format: 'date-time' })
  exportedAt!: string;

  @ApiProperty()
  exportId!: string;

  @ApiProperty({ description: 'Protected File Registry asset identifier' })
  fileAssetId!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  totalRecords!: number;

  @ApiProperty()
  validRecords!: number;

  @ApiProperty()
  invalidRecords!: number;

  @ApiProperty({
    description:
      'Exact number of blocking student-level issues, including issues omitted from the bounded response array.',
  })
  issueCount!: number;

  @ApiProperty()
  issuesTruncated!: boolean;

  @ApiProperty({ type: [IemisExportConfigurationIssueResponseDto] })
  configurationIssues!: IemisExportConfigurationIssueResponseDto[];

  @ApiProperty({ type: [IemisExportIssueResponseDto] })
  issues!: IemisExportIssueResponseDto[];
}
