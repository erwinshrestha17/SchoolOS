import { IsEmail, IsString } from 'class-validator';

export class RequestOtpLoginDto {
  @IsString()
  tenantSlug!: string;

  @IsEmail()
  email!: string;
}
