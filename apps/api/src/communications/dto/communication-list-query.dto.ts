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
import {
  AudienceType,
  NotificationChannel,
  NotificationStatus,
  NoticeLifecycleStatus,
  NoticePriority,
  NotificationPreferenceCategory,
} from '@prisma/client';
import { IsIn } from 'class-validator';

export class CommunicationPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class ListNoticesQueryDto extends CommunicationPageQueryDto {
  @IsOptional()
  @IsEnum(NoticeLifecycleStatus)
  lifecycleStatus?: NoticeLifecycleStatus;

  @IsOptional()
  @IsEnum(NoticePriority)
  priority?: NoticePriority;

  @IsOptional()
  @IsEnum(AudienceType)
  audienceType?: AudienceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListNotificationDeliveriesQueryDto extends CommunicationPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  activityPostId?: string;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class NotificationCenterQueryDto extends CommunicationPageQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'READ', 'UNREAD'])
  readStatus?: 'ALL' | 'READ' | 'UNREAD' = 'ALL';

  @IsOptional()
  @IsEnum(NotificationPreferenceCategory)
  category?: NotificationPreferenceCategory;
}
