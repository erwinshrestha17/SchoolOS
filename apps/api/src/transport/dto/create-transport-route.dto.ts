import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransportStopInput {
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
}

export class CreateTransportRouteDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransportStopInput)
  stops!: TransportStopInput[];
}
