import {
  IsBase64,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const ALLOWED_LOGO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class UploadTenantLogoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsIn(ALLOWED_LOGO_MIME_TYPES)
  mimeType!: (typeof ALLOWED_LOGO_MIME_TYPES)[number];

  @IsString()
  @IsBase64()
  base64Content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
