import { AuthMethod } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class ConfirmMfaSetupDto {
  @IsString()
  code!: string;

  @IsEnum(AuthMethod)
  authMethod!: AuthMethod;
}
