import { IsNotEmpty, IsString } from 'class-validator';

export class RejectJournalDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
