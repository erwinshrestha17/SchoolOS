import {
  NotificationChannel,
  NotificationPreferenceCategory,
} from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationPreferenceCategory)
  category!: NotificationPreferenceCategory;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;
}
