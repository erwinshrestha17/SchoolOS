import {
  IsDateString,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateLibraryReservationDto {
  @IsString()
  bookId!: string;

  @IsOptional()
  @IsString()
  copyId?: string;

  @ValidateIf((dto: CreateLibraryReservationDto) => !dto.borrowerStaffId)
  @IsString()
  borrowerStudentId?: string;

  @ValidateIf((dto: CreateLibraryReservationDto) => !dto.borrowerStudentId)
  @IsString()
  borrowerStaffId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FulfillLibraryReservationDto {
  @IsOptional()
  @IsString()
  copyId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
