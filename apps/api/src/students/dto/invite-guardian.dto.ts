import { IsOptional, IsString } from 'class-validator';

export class InviteGuardianDto {
  @IsOptional()
  @IsString()
  guardianId?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
