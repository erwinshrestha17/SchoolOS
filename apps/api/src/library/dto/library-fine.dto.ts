import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { LibraryFineStatus } from '@prisma/client';

export class CreateLibraryFineDto {
  @IsUUID()
  issueId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLibraryFineDto {
  @IsOptional()
  @IsEnum(LibraryFineStatus)
  status?: LibraryFineStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waivedAmount?: number;

  @IsOptional()
  @IsString()
  waiverReason?: string;

  @IsOptional()
  @IsString()
  correctionReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
