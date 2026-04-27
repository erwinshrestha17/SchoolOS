import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ChartAccountType } from '@prisma/client';

export class CreateChartAccountDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(ChartAccountType)
  type!: ChartAccountType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
