import { TransportBoardingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class RecordTransportLogDto {
  @IsString()
  routeId!: string;

  @IsOptional()
  @IsString()
  stopId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsEnum(TransportBoardingStatus)
  status!: TransportBoardingStatus;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
