import { IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  conversationId!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
