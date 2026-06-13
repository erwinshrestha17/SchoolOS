import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MapTransportFeeDto {
  @IsString()
  feeAssignmentId!: string;

  @IsNumber()
  @Min(0)
  feeAmount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
