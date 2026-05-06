import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateTransportVehicleDto {
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsDateString()
  fitnessCertificateExp?: string;

  @IsOptional()
  @IsDateString()
  documentExpiry?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
