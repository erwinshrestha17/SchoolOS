import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LibraryCopyStatus } from '@prisma/client';

export class MarkLibraryCopyStatusDto {
  @IsEnum(LibraryCopyStatus)
  status!: LibraryCopyStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
