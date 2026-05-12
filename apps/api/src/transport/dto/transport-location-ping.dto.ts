import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class TransportLocationPingDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
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
