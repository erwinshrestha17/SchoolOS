import { IsOptional, IsString } from 'class-validator';

export class StartTransportTripDto {
  @IsString()
  routeId!: string;

  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  driverAssignmentId?: string;

  @IsString()
  direction!: 'PICKUP' | 'DROP';

  @IsOptional()
  @IsString()
  notes?: string;
}
