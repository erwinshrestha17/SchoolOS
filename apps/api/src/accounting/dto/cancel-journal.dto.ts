import { IsNotEmpty, IsString } from 'class-validator';

export class CancelJournalDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
