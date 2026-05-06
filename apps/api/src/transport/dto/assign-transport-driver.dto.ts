import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AssignTransportDriverDto {
  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  routeId?: string;

  @IsString()
  staffId!: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpires?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
