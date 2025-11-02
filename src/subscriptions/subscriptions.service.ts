import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from './schemas/subscription.schema';
import { ChannelsRepository } from '../channels/channels.repository';
import { UsersRepository } from '../users/users.repository';
import { VideosRepository } from '../videos/videos.repository';
import {
  SubscriptionsListResponseDto,
  SubscriptionFeedResponseDto,
  SubscribersListResponseDto,
} from './dto/subscription.dto';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly videosRepository: VideosRepository,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Get user's subscriptions
   */
  async getSubscriptions(
    userId: string,
  ): Promise<SubscriptionsListResponseDto> {
    const subscriptions = await this.subscriptionModel
      .find({ subscriberId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    const items = await Promise.all(
      subscriptions.map(async (sub) => {
        const channel = await this.channelsRepository.findById(
          sub.channelId.toString(),
        );
        const user = channel
          ? await this.usersRepository.findOne({
              _id: channel.userId.toString(),
            })
          : null;

        return {
          id: sub._id.toString(),
          channelId: sub.channelId.toString(),
          channelName: channel?.name || 'Unknown',
          channelHandle: channel?.handle || 'unknown',
          avatarUrl: user?.avatar || '',
          isLive: false, // TODO: Check stream status
          subscribedAt: sub.createdAt.toISOString(),
          notificationsEnabled: sub.notificationsEnabled,
        };
      }),
    );

    return {
      subscriptions: items,
      totalCount: subscriptions.length,
    };
  }

  /**
   * Get subscription feed (videos from subscribed channels)
   */
  async getSubscriptionFeed(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<SubscriptionFeedResponseDto> {
    const subscriptions = await this.subscriptionModel
      .find({ subscriberId: new Types.ObjectId(userId) })
      .exec();

    const channelIds = subscriptions.map((sub) => sub.channelId.toString());

    if (channelIds.length === 0) {
      return { videos: [] };
    }

    // Get videos from subscribed channels
    const { videos } = await this.videosRepository.findMany({
      page,
      limit,
      sort: 'latest',
      channelId: channelIds[0], // TODO: Implement multi-channel query
    });

    const formattedVideos = await Promise.all(
      videos.map(async (video) => {
        const user = await this.usersRepository.findOne({
          _id: video.userId.toString(),
        });

        return {
          id: video._id.toString(),
          title: video.title,
          thumbnailUrl: video.thumbnailUrl || '',
          duration: this.formatDuration(video.duration),
          views: video.views,
          uploadedAt: this.formatRelativeTime(
            video.publishedAt || video.createdAt,
          ),
          isLive: false,
          creator: {
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
        };
      }),
    );

    return { videos: formattedVideos };
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(userId: string, channelId: string): Promise<void> {
    const channel = await this.channelsRepository.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Check if already subscribed
    const existing = await this.subscriptionModel
      .findOne({
        subscriberId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
      })
      .exec();

    if (existing) {
      throw new ConflictException('Already subscribed to this channel');
    }

    await this.subscriptionModel.create({
      subscriberId: new Types.ObjectId(userId),
      channelId: new Types.ObjectId(channelId),
      notificationsEnabled: true,
    });

    // Increment subscriber count
    await this.channelsRepository.incrementSubscribers(channelId, 1);

    // Track analytics
    await this.analyticsService.trackEvent('subscribe', channelId);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(userId: string, channelId: string): Promise<void> {
    const result = await this.subscriptionModel
      .findOneAndDelete({
        subscriberId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
      })
      .exec();

    if (result) {
      // Decrement subscriber count
      await this.channelsRepository.incrementSubscribers(channelId, -1);

      // Track analytics
      await this.analyticsService.trackEvent('unsubscribe', channelId);
    }
  }

  /**
   * Check if user is subscribed to a channel
   */
  async isSubscribed(userId: string, channelId: string): Promise<boolean> {
    const subscription = await this.subscriptionModel
      .findOne({
        subscriberId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
      })
      .exec();

    return !!subscription;
  }

  /**
   * Get channel's subscribers (for channel owner)
   */
  async getSubscribers(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<SubscribersListResponseDto> {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.subscriptionModel
        .find({ channelId: channel._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.subscriptionModel.countDocuments({ channelId: channel._id }).exec(),
    ]);

    const subscribers = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await this.usersRepository.findOne({
          _id: sub.subscriberId.toString(),
        });
        const userChannel = await this.channelsRepository.findByUserId(
          sub.subscriberId.toString(),
        );

        return {
          id: sub.subscriberId.toString(),
          username: user?.username || 'Unknown',
          avatarUrl: user?.avatar || '',
          subscriberCount: userChannel?.subscriberCount || 0,
          subscribedAt: sub.createdAt.toISOString(),
        };
      }),
    );

    return {
      subscribers,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Toggle notifications for a subscription
   */
  async toggleNotifications(
    userId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.subscriptionModel
      .findOneAndUpdate(
        {
          subscriberId: new Types.ObjectId(userId),
          channelId: new Types.ObjectId(channelId),
        },
        { notificationsEnabled: enabled },
      )
      .exec();
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  }
}
