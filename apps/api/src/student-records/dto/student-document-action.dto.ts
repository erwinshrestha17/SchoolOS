import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ArchiveStudentDocumentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ReviewStudentDocumentDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  status!: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
