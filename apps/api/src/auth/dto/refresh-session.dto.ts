import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshSessionDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsUUID()
  installationId?: string;
}
