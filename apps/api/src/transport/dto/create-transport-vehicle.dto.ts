import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTransportVehicleDto {
  @IsString()
  registrationNumber!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsDateString()
  fitnessCertificateExp?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  @IsOptional()
  @IsDateString()
  registrationExpiry?: string;

  @IsOptional()
  @IsDateString()
  pollutionExpiry?: string;

  @IsOptional()
  @IsDateString()
  documentExpiry?: string;
}
