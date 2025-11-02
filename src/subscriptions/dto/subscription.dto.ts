import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleNotificationsDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class SubscriptionItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  channelName: string;

  @ApiProperty()
  channelHandle: string;

  @ApiProperty()
  avatarUrl: string;

  @ApiProperty()
  isLive: boolean;

  @ApiProperty()
  subscribedAt: string;

  @ApiProperty()
  notificationsEnabled: boolean;
}

export class SubscriptionsListResponseDto {
  @ApiProperty({ type: [SubscriptionItemDto] })
  subscriptions: SubscriptionItemDto[];

  @ApiProperty()
  totalCount: number;
}

export class SubscriberItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  avatarUrl: string;

  @ApiProperty()
  subscriberCount: number;

  @ApiProperty()
  subscribedAt: string;
}

export class SubscribersListResponseDto {
  @ApiProperty({ type: [SubscriberItemDto] })
  subscribers: SubscriberItemDto[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export class VideoFeedItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  thumbnailUrl: string;

  @ApiProperty()
  duration: string;

  @ApiProperty()
  views: number;

  @ApiProperty()
  uploadedAt: string;

  @ApiProperty()
  isLive: boolean;

  @ApiProperty()
  creator: {
    username: string;
    avatarUrl: string;
  };
}

export class SubscriptionFeedResponseDto {
  @ApiProperty({ type: [VideoFeedItemDto] })
  videos: VideoFeedItemDto[];

  @ApiPropertyOptional()
  groupedBy?: 'today' | 'thisWeek' | 'thisMonth' | 'older';
}
