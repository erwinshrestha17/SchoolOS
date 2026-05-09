import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ArchiveLibraryBookDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
