import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBrandingDocumentsDto {
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptHeaderText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  receiptFooterText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  idCardFooterText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  payslipFooterText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  certificateFooterText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reportCardFooterText?: string | null;

  @IsOptional()
  @IsIn(['A4', 'LEGAL', '80MM'])
  defaultPaperSize?: 'A4' | 'LEGAL' | '80MM' | null;
}
