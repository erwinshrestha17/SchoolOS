import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { StudentQrResolvePurpose } from '@schoolos/core';

export class ResolveStudentQrDto {
  @ApiProperty({
    example: 'scanned-token',
    description: 'The raw token from the QR code',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    enum: StudentQrResolvePurpose,
    description: 'The purpose for which the QR is being resolved',
  })
  @IsEnum(StudentQrResolvePurpose)
  @IsNotEmpty()
  purpose!: StudentQrResolvePurpose;
}

export class RotateStudentQrDto {
  @ApiProperty({
    required: false,
    description: 'Reason for rotating the QR credential',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RevokeStudentQrDto {
  @ApiProperty({
    required: false,
    description: 'Reason for revoking the QR credential',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
