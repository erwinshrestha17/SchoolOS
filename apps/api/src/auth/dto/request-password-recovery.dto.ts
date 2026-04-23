import { IsEmail, IsString } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsString()
  tenantSlug!: string;

  @IsEmail()
  email!: string;
}
