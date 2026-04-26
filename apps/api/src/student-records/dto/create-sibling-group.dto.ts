import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SiblingMemberDto {
  @IsString()
  studentId!: string;

  @IsOptional()
  @IsString()
  relationship?: string;
}

export class CreateSiblingGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => SiblingMemberDto)
  members!: SiblingMemberDto[];
}
