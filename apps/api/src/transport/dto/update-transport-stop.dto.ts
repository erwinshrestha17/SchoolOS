import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTransportStopDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sequence?: number;

  @IsOptional()
  @IsString()
  estimatedPickup?: string;

  @IsOptional()
  @IsString()
  estimatedDrop?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
