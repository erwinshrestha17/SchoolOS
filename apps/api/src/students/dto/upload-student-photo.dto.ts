import { IsBase64, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const ALLOWED_STUDENT_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class UploadStudentPhotoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsIn(ALLOWED_STUDENT_PHOTO_MIME_TYPES)
  mimeType!: (typeof ALLOWED_STUDENT_PHOTO_MIME_TYPES)[number];

  @IsString()
  @IsBase64()
  base64Content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
