import { ConsentType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class GuardianConsentActionDto {
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsString()
  version!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
