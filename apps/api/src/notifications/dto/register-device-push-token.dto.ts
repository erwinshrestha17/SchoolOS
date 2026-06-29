import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDevicePushTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  token!: string;

  @IsUUID()
  installationId!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceModel?: string;
}
