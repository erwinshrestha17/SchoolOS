import {
  IsDateString,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ReturnLibraryCopyDto } from './return-library-copy.dto';

export class ScanLibraryCopyDto {
  @IsString()
  code!: string;
}

export class ScannerIssueLibraryCopyDto {
  @IsString()
  code!: string;

  @ValidateIf((dto: ScannerIssueLibraryCopyDto) => !dto.borrowerStaffId)
  @IsString()
  borrowerStudentId?: string;

  @ValidateIf((dto: ScannerIssueLibraryCopyDto) => !dto.borrowerStudentId)
  @IsString()
  borrowerStaffId?: string;

  @IsOptional()
  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScannerReturnLibraryCopyDto extends ReturnLibraryCopyDto {
  @IsString()
  code!: string;
}
