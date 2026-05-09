import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnlockExamTermDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
