import { IsString } from 'class-validator';

export class RevokeGeneratedStudentDocumentDto {
  @IsString()
  reason!: string;
}
