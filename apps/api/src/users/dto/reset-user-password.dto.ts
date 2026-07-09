import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  requireChangeOnNextLogin?: boolean;
}
