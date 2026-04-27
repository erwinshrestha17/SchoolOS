import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateLibraryCopyDto {
  @IsString()
  bookId!: string;

  @IsString()
  barcode!: string;

  @IsOptional()
  @IsString()
  qrCode?: string;

  @IsOptional()
  @IsString()
  shelfLocation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  replacementCost?: number;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
