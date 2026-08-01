import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountingPostingBatchStatus } from '@prisma/client';

export class ListPostingBatchesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsEnum(AccountingPostingBatchStatus)
  status?: AccountingPostingBatchStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceModule?: string;
}
