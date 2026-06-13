import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ScheduleOneDayRouteChangeDto {
  @IsString()
  studentId!: string;

  @IsString()
  routeId!: string;

  @IsString()
  stopId!: string;

  @IsDateString()
  serviceDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
