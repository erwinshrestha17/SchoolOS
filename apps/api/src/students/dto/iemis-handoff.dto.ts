import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ExternalAuthorityHandoffStatus } from '@prisma/client';

export class CreateIemisHandoffDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  reportExportId!: string;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  supersedesHandoffId?: string;
}

export class RecordIemisHandoffEventDto {
  @ApiProperty({
    enum: [
      'EXPORTED',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'REJECTED',
      'CORRECTION_REQUIRED',
    ],
  })
  @IsEnum(ExternalAuthorityHandoffStatus)
  status!: ExternalAuthorityHandoffStatus;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  evidenceFileId?: string;

  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReceiptReference?: string;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
