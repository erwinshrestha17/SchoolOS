import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransportStopDto {
  @IsString()
  routeId!: string;

  @IsString()
  name!: string;

  @IsInt()
  sequence!: number;

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
