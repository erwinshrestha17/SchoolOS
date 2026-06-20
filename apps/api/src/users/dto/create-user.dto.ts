import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import {
  IsNepalPhone,
  IsProfileEmail,
  NormalizeEmailAddress,
  NormalizeNepalPhone,
} from '../../common/validation/contact-profile.decorators';

export class CreateUserDto {
  @NormalizeEmailAddress()
  @IsProfileEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @NormalizeNepalPhone()
  @IsNepalPhone()
  phone?: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
