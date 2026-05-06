import { IsOptional, IsString } from 'class-validator';

export class CompleteTransportTripDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
