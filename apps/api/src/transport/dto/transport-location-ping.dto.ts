import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class TransportLocationPingDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  speedKph?: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
