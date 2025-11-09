import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import {
  DailyAnalytics,
  DailyAnalyticsDocument,
} from './schemas/daily-analytics.schema';
import { ChannelsRepository } from '../channels/channels.repository';
import { VideosRepository } from '../videos/videos.repository';

interface DailyAnalyticsFilter {
  channelId: Types.ObjectId;
  date: string;
  videoId: Types.ObjectId | null;
}

interface AnalyticsStats {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalSubscribersGained: number;
  totalWatchTime: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(DailyAnalytics.name)
    private dailyAnalyticsModel: Model<DailyAnalyticsDocument>,
    private readonly channelsRepository: ChannelsRepository,
    private readonly videosRepository: VideosRepository,
  ) {}

  /**
   * Track an analytics event
   */
  async trackEvent(
    type: 'view' | 'like' | 'comment' | 'subscribe' | 'unsubscribe' | 'share',
    channelId: string,
    videoId?: string,
    value: number = 1,
  ) {
    const today = new Date().toISOString().split('T')[0];
    const update: UpdateQuery<DailyAnalyticsDocument> = {};

    switch (type) {
      case 'view':
        update.$inc = { views: value };
        break;
      case 'like':
        update.$inc = { likes: value };
        break;
      case 'comment':
        update.$inc = { comments: value };
        break;
      case 'share':
        update.$inc = { shares: value };
        break;
      case 'subscribe':
        update.$inc = { newSubscribers: value };
        break;
      case 'unsubscribe':
        update.$inc = { newSubscribers: -value };
        break;
    }

    // Upsert daily record for this channel/video
    const filter: DailyAnalyticsFilter = {
      channelId: new Types.ObjectId(channelId),
      date: today,
      videoId: videoId ? new Types.ObjectId(videoId) : null,
    };

    await this.dailyAnalyticsModel.findOneAndUpdate(filter, update, {
      upsert: true,
    });
  }

  /**
   * Get channel analytics
   */
  async getChannelAnalytics(userId: string, period: string) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      return this.getEmptyAnalytics(period);
    }

    // Determine date range
    const endDate = new Date();
    const startDate = new Date();

    if (period === 'last7days') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === 'today') {
      // today (start is same day 00:00 - handled by ISO string split logic usually,
      // but for simple query we can just filter by date string >= today's string)
    } else {
      // Default last 28 days
      startDate.setDate(endDate.getDate() - 28);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Aggregate data
    const analytics = await this.dailyAnalyticsModel.aggregate<AnalyticsStats>([
      {
        $match: {
          channelId: channel._id,
          date: { $gte: startStr, $lte: endStr },
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: '$likes' },
          totalComments: { $sum: '$comments' },
          totalSubscribersGained: { $sum: '$newSubscribers' },
          totalWatchTime: { $sum: '$watchTimeSeconds' },
        },
      },
    ]);

    const stats = analytics[0] || {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalSubscribersGained: 0,
      totalWatchTime: 0,
    };

    return {
      overview: {
        views: this.formatNumber(stats.totalViews),
        watchTimeHours: this.formatNumber(
          Math.floor(stats.totalWatchTime / 3600),
        ),
        subscribers: channel.subscriberCount,
        subscriberChange: stats.totalSubscribersGained,
        estimatedRevenue: null,
      },
      period,
      trends: {
        views: this.calculateTrend(stats.totalViews), // Placeholder for actual trend calc
        watchTime: this.calculateTrend(stats.totalWatchTime),
        subscribers: this.calculateTrend(stats.totalSubscribersGained),
      },
    };
  }

  private calculateTrend(value: number): number {
    // Simple mock trend for UI visual
    return value > 0 ? 10 : 0;
  }

  /**
   * Get realtime analytics
   */
  async getRealtimeAnalytics(userId: string) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      return { currentViewers: 0, views48Hours: [] };
    }

    // Generate mock 48-hour data
    const views48Hours = Array.from({ length: 48 }, (_, i) => ({
      hour: i,
      views: Math.floor(Math.random() * 100),
    }));

    return {
      currentViewers: 0, // TODO: Track active viewers
      views48Hours,
    };
  }

  /**
   * Get video analytics
   */
  async getVideoAnalytics(videoId: string, userId: string) {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      return null;
    }

    if (video.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You can only view analytics for your own videos',
      );
    }

    return {
      videoId: video._id.toString(),
      title: video.title,
      thumbnailUrl: video.thumbnailUrl || '',
      metrics: {
        views: video.views,
        ctr: `${Math.floor(Math.random() * 20) + 5}%`,
        avgDuration: this.formatDuration(Math.floor(video.duration * 0.6)),
        likes: video.likes,
        comments: 0, // TODO: Count comments
      },
      comparison: {
        period: 'first24hours',
        previousVideo: {
          views: Math.floor(video.views * 0.8),
          percentageDiff: Math.floor(Math.random() * 40) - 20,
        },
      },
    };
  }

  /**
   * Get top performing content
   */
  async getTopContent(userId: string, period: string) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      return { videos: [], period };
    }

    const videos = await this.videosRepository.findByChannelId(
      channel._id.toString(),
      10,
    );

    // Sort by views for top content
    const sortedVideos = [...videos].sort((a, b) => b.views - a.views);

    return {
      videos: sortedVideos.map((video, index) => ({
        id: video._id.toString(),
        title: video.title,
        thumbnailUrl: video.thumbnailUrl || '',
        views: video.views,
        rank: index + 1,
      })),
      period,
    };
  }

  private getEmptyAnalytics(period: string) {
    return {
      overview: {
        views: '0',
        watchTimeHours: '0',
        subscribers: 0,
        subscriberChange: 0,
        estimatedRevenue: null,
      },
      period,
      trends: {
        views: 0,
        watchTime: 0,
        subscribers: 0,
      },
    };
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
