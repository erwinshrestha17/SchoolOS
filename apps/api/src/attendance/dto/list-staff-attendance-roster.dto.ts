import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type {
  StaffAttendanceRosterItem,
  StaffAttendanceRosterPage,
} from '@schoolos/core';

export class ListStaffAttendanceRosterDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;
}

export class StaffAttendanceRosterItemResponseDto implements StaffAttendanceRosterItem {
  @ApiProperty({ format: 'uuid' })
  staffId!: string;

  @ApiProperty()
  employeeId!: string;

  @ApiProperty()
  fullName!: string;
}

export class StaffAttendanceRosterPageResponseDto implements StaffAttendanceRosterPage {
  @ApiProperty({ type: [StaffAttendanceRosterItemResponseDto] })
  items!: StaffAttendanceRosterItem[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;
}
