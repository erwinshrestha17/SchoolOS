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

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsDateString()
  fitnessCertificateExp?: string;
}
