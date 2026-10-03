import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutoryScheme } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStatutoryMembershipDto {
  @ApiProperty({ enum: StatutoryScheme })
  @IsEnum(StatutoryScheme)
  scheme!: StatutoryScheme;

  @ApiPropertyOptional({
    maxLength: 64,
    description:
      'The member number issued by the scheme. Protected under hr:tax:*.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  memberIdentifier?: string;

  @ApiProperty({ example: '2026-04-14', description: 'Calendar date' })
  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @ApiPropertyOptional({
    example: '2027-04-13',
    description: 'Exclusive end date; omit for an open membership',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  effectiveTo?: string;
}

export class EndStatutoryMembershipDto {
  @ApiProperty({
    example: '2026-09-01',
    description: 'First date the membership no longer applies',
  })
  @IsDateString({ strict: true })
  effectiveTo!: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class StatutoryPolicyQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Date to resolve the policy for; defaults to today',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  asOf?: string;
}
