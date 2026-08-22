import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SchoolSettingsDomainChangeDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsDefined()
  value!: unknown;
}

export class UpdateSchoolSettingsDomainDto {
  @IsString()
  @MaxLength(4000)
  expectedVersion!: string;

  @IsUUID()
  idempotencyKey!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SchoolSettingsDomainChangeDto)
  changes!: SchoolSettingsDomainChangeDto[];
}
