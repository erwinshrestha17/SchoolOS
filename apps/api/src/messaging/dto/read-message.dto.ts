import { IsOptional, IsString } from 'class-validator';

export class ReadMessageDto {
  @IsString()
  messageId!: string;

  @IsOptional()
  @IsString()
  guardianId?: string;
}
