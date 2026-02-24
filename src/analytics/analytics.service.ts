import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import {
  DailyAnalytics,
  DailyAnalyticsDocument,
} from './schemas/daily-analytics.schema';
import { ChannelsRepository } from '../channels/channels.repository';
import { VideosRepository } from '../videos/videos.repository';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { VideoDocument } from '../videos/schemas/video.schema';

interface DailyAnalyticsFilter {
  channelId: Types.ObjectId;
  date: string;
  videoId: Types.ObjectId | null;
}

interface OverviewStats {
  views: number | string;
  watch_time_hours: number | string;
  subscriber_change: number | string;
  avg_view_duration: number | string;
}

interface RealtimeStats {
  active_viewers: number | string;
}

interface VelocityPoint {
  hour: string;
  views: number | string;
}

interface TopContentItem {
  video_id: string;
  title: string;
  thumbnail_url: string;
  views: number | string;
  avg_view_duration: number | string;
}

interface SearchQueryStats {
  query: string;
  count: number | string;
}

interface EngagementTrendPoint {
  bucket: string;
  comments: number | string;
  likes: number | string;
  shares: number | string;
}

@Injectable()
export class AnalyticsService {
  private readonly hubUrl: string;
  private readonly apiKey: string;

  constructor(
    @InjectModel(DailyAnalytics.name)
    private dailyAnalyticsModel: Model<DailyAnalyticsDocument>,
    private readonly channelsRepository: ChannelsRepository,
    private readonly videosRepository: VideosRepository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('ANALYTICS_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {
    this.hubUrl = this.configService.get<string>('ANALYTICS_HUB_URL', '');
    this.apiKey = this.configService.get<string>('SERVICE_API_KEY', '');
  }

  /**
   * Track an analytics event
   */
  async trackEvent(
    type:
      | 'view'
      | 'like'
      | 'comment'
      | 'subscribe'
      | 'unsubscribe'
      | 'share'
      | 'search',
    channelId?: string,
    videoId?: string,
    value: number = 1,
    metadata: Record<string, unknown> = {},
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const update: UpdateQuery<DailyAnalyticsDocument> = {};

      // Legacy Mongoose Update
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
        case 'search':
          break;
      }

      if (channelId) {
        const filter: DailyAnalyticsFilter = {
          channelId: new Types.ObjectId(channelId),
          date: today,
          videoId: videoId ? new Types.ObjectId(videoId) : null,
        };

        try {
          await this.dailyAnalyticsModel.findOneAndUpdate(filter, update, {
            upsert: true,
          });
        } catch (e) {
          console.error('Track event mongoose error:', e);
        }
      }

      // Hub Integration
      const eventName = type === 'view' ? 'video_view' : type;
      await this.trackGenericEvent(
        eventName,
        {
          channel_id: channelId || 'global',
          video_id: videoId || null,
          value,
          ...metadata,
        },
        'anonymous',
      );
    } catch (e) {
      console.error('Track event error:', e);
    }
  }

  /**
   * Push a generic event to the Analytics Hub via Kafka
   */
  async trackGenericEvent(
    eventName: string,
    properties: Record<string, unknown>,
    userId: string = 'anonymous',
  ) {
    try {
      await firstValueFrom(
        this.kafkaClient.emit('octane.events', {
          app_id: 'openstream',
          event_name: eventName,
          user_id: userId,
          timestamp: new Date().toISOString(),
          properties: {
            ...properties,
            platform: 'web',
            user_agent: (properties.user_agent as string) || 'unknown',
          },
        }),
      );
    } catch (e) {
      console.error(`Failed to emit event ${eventName}:`, e);
    }
  }

  /**
   * Get channel analytics
   */
  async getChannelAnalytics(userId: string, period: string) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      return this.getEmptyAnalytics(period);
    }

    const intervalDays =
      period === 'last7days' ? 7 : period === 'today' ? 1 : 28;

    try {
      const [statsRes, trendRes] = await Promise.all([
        firstValueFrom(
          this.httpService.post<OverviewStats[]>(
            `${this.hubUrl}/report`,
            {
              template: 'overview_stats',
              params: {
                app_id: 'openstream',
                days: intervalDays,
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
        firstValueFrom(
          this.httpService.post<any[]>(
            `${this.hubUrl}/report`,
            {
              template: 'chronological_trend',
              params: {
                app_id: 'openstream',
                days: intervalDays,
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
      ]);

      const stats = statsRes.data[0] || {
        views: 0,
        watch_time_hours: 0,
        subscriber_change: 0,
        avg_view_duration: 0,
      };

      return {
        overview: {
          views: this.formatNumber(Number(stats.views)),
          watchTimeHours: this.formatNumber(Number(stats.watch_time_hours)),
          subscribers: channel.subscriberCount,
          subscriberChange: Number(stats.subscriber_change),
          avgViewDuration: this.formatDuration(
            Math.floor(Number(stats.avg_view_duration || 0)),
          ),
          estimatedRevenue: null,
        },
        trend: trendRes.data,
        period,
        trends: {
          views: 10,
          watchTime: 12,
          subscribers: 5,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Analytics Hub query error:', message);
      return this.getEmptyAnalytics(period);
    }
  }

  /**
   * Get realtime analytics
   */
  async getRealtimeAnalytics(userId: string) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) return { currentViewers: 0, views48Hours: [] };

    try {
      const [statsRes, velocityRes] = await Promise.all([
        firstValueFrom(
          this.httpService.post<RealtimeStats[]>(
            `${this.hubUrl}/report`,
            {
              template: 'realtime_stats',
              params: {
                app_id: 'openstream',
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
        firstValueFrom(
          this.httpService.post<VelocityPoint[]>(
            `${this.hubUrl}/report`,
            {
              template: 'realtime_velocity',
              params: {
                app_id: 'openstream',
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
      ]);

      const stats = statsRes.data[0] || { active_viewers: 0 };
      const velocity = velocityRes.data;

      return {
        currentViewers: Number(stats.active_viewers || 0),
        views48Hours: velocity.map((row) => ({
          hour: row.hour,
          views: Number(row.views),
        })),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Realtime Hub query error:', message);
      return { currentViewers: 0, views48Hours: [] };
    }
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
        comments: 0,
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

    const intervalDays = period === 'last7days' ? 7 : 28;

    try {
      const response = await firstValueFrom(
        this.httpService.post<TopContentItem[]>(
          `${this.hubUrl}/report`,
          {
            template: 'top_content',
            params: {
              app_id: 'openstream',
              days: intervalDays,
              limit: 10,
              channel_id: channel._id.toString(),
            },
          },
          {
            headers: { 'X-API-KEY': this.apiKey },
          },
        ),
      );

      const items = response.data;
      const videoIds = items.map((i) => i.video_id);
      const videos = await this.videosRepository.findManyByIds(videoIds);

      const videoMap = new Map<string, VideoDocument>(
        videos
          .filter((v) => v.userId.toString() === userId)
          .map((v) => [v._id.toString(), v]),
      );
      const baseUrl = this.videosRepository.getBaseUrl();

      return {
        videos: items
          .filter((item) => videoMap.has(item.video_id))
          .map((item, index) => {
            const video = videoMap.get(item.video_id)!;
            return {
              id: item.video_id,
              title: video.title || item.title || 'Untitled Sequence',
              thumbnailUrl: video
                ? video.thumbnailUrl?.startsWith('http')
                  ? video.thumbnailUrl
                  : `${baseUrl}/${video.thumbnailUrl}`
                : item.thumbnail_url,
              views: Number(item.views),
              avgViewDuration: this.formatDuration(
                Math.floor(Number(item.avg_view_duration || 0)),
              ),
              rank: index + 1,
            };
          }),
        period,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Top content report error:', message);
      return { videos: [], period };
    }
  }

  /**
   * Get engagement analytics (social + search)
   */
  async getEngagementAnalytics(userId: string, period: string = 'last28days') {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) return { trend: [], topSearches: [], period };

    const days = period === 'last7days' ? 7 : period === 'today' ? 1 : 28;
    const interval = days >= 7 ? '1 day' : '1 hour';

    try {
      const [engagementRes, searchRes] = await Promise.all([
        firstValueFrom(
          this.httpService.post<EngagementTrendPoint[]>(
            `${this.hubUrl}/report`,
            {
              template: 'engagement_trend',
              params: {
                app_id: 'openstream',
                days,
                interval,
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
        firstValueFrom(
          this.httpService.post<SearchQueryStats[]>(
            `${this.hubUrl}/report`,
            {
              template: 'search_analytics',
              params: {
                app_id: 'openstream',
                days,
                limit: 10,
                channel_id: channel._id.toString(),
              },
            },
            {
              headers: { 'X-API-KEY': this.apiKey },
            },
          ),
        ),
      ]);

      return {
        trend: engagementRes.data.map((p) => ({
          bucket: p.bucket,
          comments: Number(p.comments),
          likes: Number(p.likes),
          shares: Number(p.shares),
        })),
        topSearches: searchRes.data.map((s) => ({
          query: s.query,
          count: Number(s.count),
        })),
        period,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Analytics] Engagement analytics report error:', message);
      return { trend: [], topSearches: [], period };
    }
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
