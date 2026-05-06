import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTransportRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}
