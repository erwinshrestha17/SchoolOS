import { ApiProperty } from '@nestjs/swagger';

export class OperationalDashboardSummaryResponseDto {
  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ example: '2026-07-31' })
  schoolDay!: string;

  @ApiProperty({ example: 'dashboard' })
  module!: string;

  @ApiProperty({
    enum: ['admin', 'principal', 'hr', 'accountant'],
    description:
      'Server-resolved dashboard composition persona. Unsupported personas receive HTTP 403.',
  })
  compositionPersona!: 'admin' | 'principal' | 'hr' | 'accountant';

  @ApiProperty({
    enum: ['ready', 'empty', 'partial', 'locked', 'permissionDenied'],
  })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  summary!: Record<string, unknown>;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  attentionItems!: unknown[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  recentItems!: unknown[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  nextActions!: unknown[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  modules!: unknown[];
}
