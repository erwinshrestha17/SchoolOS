import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateActivityPostDto {
  @IsIn(['APPROVED', 'REJECTED', 'PENDING'])
  status!: 'APPROVED' | 'REJECTED' | 'PENDING';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteActivityPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
