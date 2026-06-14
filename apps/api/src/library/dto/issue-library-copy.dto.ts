import { IsDateString, IsOptional, IsString, ValidateIf } from 'class-validator';

export class IssueLibraryCopyDto {
  @IsString()
  copyId!: string;

  @ValidateIf((dto: IssueLibraryCopyDto) => !dto.borrowerStaffId)
  @IsString()
  borrowerStudentId?: string;

  @ValidateIf((dto: IssueLibraryCopyDto) => !dto.borrowerStudentId)
  @IsString()
  borrowerStaffId?: string;

  @IsOptional()
  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
