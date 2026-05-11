import { IsArray, IsEnum, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountingReportMappingType } from '@prisma/client';

export class AccountingReportMappingItemDto {
  @IsEnum(AccountingReportMappingType)
  mappingType: AccountingReportMappingType;

  @IsString()
  accountId: string;
}

export class UpdateAccountingReportMappingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountingReportMappingItemDto)
  mappings: AccountingReportMappingItemDto[];
}
