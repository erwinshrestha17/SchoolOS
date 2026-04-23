import { IsString } from 'class-validator';

export class VerifyOtpLoginDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  code!: string;
}
