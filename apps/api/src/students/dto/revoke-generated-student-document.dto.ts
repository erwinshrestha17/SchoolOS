import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RevokeGeneratedStudentDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
