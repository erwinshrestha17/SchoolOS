import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddressType } from '@prisma/client';

export class AddressInputDto {
  @IsOptional()
  @IsEnum(AddressType)
  addressType?: AddressType;

  // Backend-validated FK into NepalLocalLevel -- never trust the client's
  // province/district selection without re-checking this id exists.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  localLevelId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  wardNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  streetAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsLatitude()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  @Type(() => Number)
  longitude?: number;
}
