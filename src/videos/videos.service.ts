import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { VideosRepository, VideoQueryOptions } from './videos.repository';
import { ChannelsRepository } from '../channels/channels.repository';
import { UsersRepository } from '../users/users.repository';
import { AnalyticsService } from '../analytics/analytics.service';
import { CommentsService } from '../comments/comments.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoQueryDto,
  VideoListResponseDto,
  VideoListItemDto,
  VideoDetailDto,
} from './dto/video.dto';
import {
  Video,
  VideoDocument,
  VideoStatus,
  VideoVisibility,
  HighlightStatus,
} from './schemas/video.schema';
import { ChannelDocument } from '../channels/schemas/channel.schema';
import { ConfigService } from '@nestjs/config';

interface UserDoc {
  username?: string;
  avatar?: string;
}

@Injectable()
export class VideosService {
  constructor(
    private readonly videosRepository: VideosRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly commentsService: CommentsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new video
   */
  async createVideo(
    userId: string,
    createDto: CreateVideoDto,
  ): Promise<VideoDetailDto> {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      throw new NotFoundException(
        'Channel not found. Please create a channel first.',
      );
    }

    const video = await this.videosRepository.create({
      userId: new Types.ObjectId(userId),
      channelId: channel._id,
      title: createDto.title,
      description: createDto.description || '',
      visibility: createDto.visibility || VideoVisibility.PRIVATE,
      category: createDto.category,
      thumbnailUrl: createDto.thumbnailUrl || null,
      videoUrl: createDto.videoUrl || null,
      status: createDto.status || VideoStatus.DRAFT,
    });

    // Increment channel video count
    await this.channelsRepository.incrementVideoCount(
      channel._id.toString(),
      1,
    );

    const user = await this.usersRepository.findOne({ _id: userId });

    return this.formatVideoDetail(video, user, channel, userId);
  }

  /**
   * Get video by ID
   */
  async getVideoById(id: string, userId?: string): Promise<VideoDetailDto> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check visibility permissions
    const isOwner = userId && video.userId.toString() === userId;
    if (video.visibility === VideoVisibility.PRIVATE && !isOwner) {
      throw new ForbiddenException('This video is private');
    }

    const channel = await this.channelsRepository.findById(
      video.channelId.toString(),
    );
    const user = await this.usersRepository.findOne({
      _id: video.userId.toString(),
    });

    // Get like status if user is authenticated
    let liked = false;
    let disliked = false;
    if (userId) {
      const like = await this.videosRepository.findLike(id, userId);
      if (like) {
        liked = like.type === 'like';
        disliked = like.type === 'dislike';
      }
    }

    return this.formatVideoDetail(
      video,
      user,
      channel,
      userId,
      liked,
      disliked,
    );
  }

  /**
   * List videos with pagination and filtering
   */
  async listVideos(
    queryDto: VideoQueryDto,
    userId?: string,
  ): Promise<VideoListResponseDto> {
    const options: VideoQueryOptions = {
      page: queryDto.page || 1,
      limit: queryDto.limit || 12,
      sort: queryDto.sort || 'latest',
      category: queryDto.category,
      channelId: queryDto.channelId,
      visibility: queryDto.visibility,
      status: queryDto.status,
      isLive: queryDto.isLive,
    };

    // Only show private videos if owner is requesting
    if (options.visibility === VideoVisibility.PRIVATE && !userId) {
      options.visibility = VideoVisibility.PUBLIC;
    }

    if (userId && options.channelId) {
      const channel = await this.channelsRepository.findById(options.channelId);

      if (channel && channel.userId.toString() === userId) {
        if (!options.visibility) {
          options.visibility = {
            $in: Object.values(VideoVisibility),
          };
        }

        if (!options.status) {
          options.status = {
            $in: Object.values(VideoStatus),
          };
        }
      }
    }

    const { videos, total } = await this.videosRepository.findMany(options);

    const videoItems = await Promise.all(
      videos.map((video) => this.formatVideoListItem(video)),
    );

    return {
      videos: videoItems,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        hasMore: options.page * options.limit < total,
      },
    };
  }

  /**
   * Get trending videos
   */
  async getTrendingVideos(limit: number = 12): Promise<VideoListItemDto[]> {
    const videos = await this.videosRepository.findTrending(limit);
    return Promise.all(videos.map((video) => this.formatVideoListItem(video)));
  }

  /**
   * Get personalized feed for authenticated user
   */
  async getFeed(
    userId: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<VideoListResponseDto> {
    // For now, return latest public videos
    // TODO: Implement personalization based on subscriptions
    const options: VideoQueryOptions = {
      page,
      limit,
      sort: 'latest',
    };

    const { videos, total } = await this.videosRepository.findMany(options);

    const videoItems = await Promise.all(
      videos.map((video) => this.formatVideoListItem(video)),
    );

    return {
      videos: videoItems,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Get video recommendations
   */
  async getRecommendations(
    videoId: string,
    limit: number = 10,
  ): Promise<VideoListItemDto[]> {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    let recommendations = await this.videosRepository.findRecommendations(
      videoId,
      video.category,
      limit,
    );

    // Fallback: If no related videos in same category, show trending videos
    if (recommendations.length === 0) {
      recommendations = await this.videosRepository.findTrending(limit);
      recommendations = recommendations.filter(
        (v) => v._id.toString() !== videoId,
      );
    }

    return Promise.all(recommendations.map((v) => this.formatVideoListItem(v)));
  }

  /**
   * Update video
   */
  async updateVideo(
    id: string,
    userId: string,
    updateDto: UpdateVideoDto,
  ): Promise<VideoDetailDto> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.userId.toString() !== userId) {
      throw new ForbiddenException('You cannot update this video');
    }

    const updateData = { ...updateDto };
    if (updateDto.status === VideoStatus.PUBLISHED && !video.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const updatedVideo = await this.videosRepository.update(id, updateData);

    const channel = await this.channelsRepository.findById(
      video.channelId.toString(),
    );
    const user = await this.usersRepository.findOne({ _id: userId });

    return this.formatVideoDetail(updatedVideo!, user, channel, userId);
  }

  /**
   * Delete video
   */
  async deleteVideo(id: string, userId: string): Promise<void> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.userId.toString() !== userId) {
      throw new ForbiddenException('You cannot delete this video');
    }

    await this.videosRepository.delete(id);

    // Decrement channel video count
    await this.channelsRepository.incrementVideoCount(
      video.channelId.toString(),
      -1,
    );
  }

  /**
   * Increment view count
   */
  async incrementView(id: string): Promise<void> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.videosRepository.incrementViews(id);

    // Increment channel total views
    await this.channelsRepository.incrementViews(video.channelId.toString(), 1);

    // Track analytics
    await this.analyticsService.trackEvent(
      'view',
      video.channelId.toString(),
      id,
    );
  }

  /**
   * Like a video
   */
  async likeVideo(id: string, userId: string): Promise<void> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const existingLike = await this.videosRepository.findLike(id, userId);

    if (existingLike) {
      if (existingLike.type === 'like') {
        // Already liked, do nothing
        return;
      }
      // Change from dislike to like
      await this.videosRepository.updateLike(id, userId, 'like');
      await this.videosRepository.incrementLikes(id, 1);
      await this.videosRepository.incrementDislikes(id, -1);

      await this.analyticsService.trackEvent(
        'like',
        video.channelId.toString(),
        id,
        1,
      );
    } else {
      // New like
      await this.videosRepository.createLike(id, userId, 'like');
      await this.videosRepository.incrementLikes(id, 1);

      await this.analyticsService.trackEvent(
        'like',
        video.channelId.toString(),
        id,
        1,
      );
    }
  }

  /**
   * Remove like from video
   */
  async unlikeVideo(id: string, userId: string): Promise<void> {
    const existingLike = await this.videosRepository.findLike(id, userId);

    if (existingLike && existingLike.type === 'like') {
      await this.videosRepository.deleteLike(id, userId);
      await this.videosRepository.incrementLikes(id, -1);

      const video = await this.videosRepository.findById(id);
      if (video) {
        await this.analyticsService.trackEvent(
          'like',
          video.channelId.toString(),
          id,
          -1,
        );
      }
    }
  }

  /**
   * Dislike a video
   */
  async dislikeVideo(id: string, userId: string): Promise<void> {
    const video = await this.videosRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const existingLike = await this.videosRepository.findLike(id, userId);

    if (existingLike) {
      if (existingLike.type === 'dislike') {
        // Already disliked, do nothing
        return;
      }
      // Change from like to dislike
      await this.videosRepository.updateLike(id, userId, 'dislike');
      await this.videosRepository.incrementLikes(id, -1);
      await this.videosRepository.incrementDislikes(id, 1);
    } else {
      // New dislike
      await this.videosRepository.createLike(id, userId, 'dislike');
      await this.videosRepository.incrementDislikes(id, 1);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Content Intelligence Layer API Methods
  // ─────────────────────────────────────────────────────────

  /**
   * Get highlight clips for a video
   */
  async getHighlights(videoId: string) {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const baseUrl = this.getBaseUrl();
    const fixRelative = (url: string | undefined | null) => {
      if (!url) return '';
      return url.startsWith('http') ? url : `${baseUrl}/${url}`;
    };

    const resolvedClips = (video.highlights || []).map((h) => ({
      ...h,
      clipUrl: fixRelative(h.clipUrl),
      thumbnailUrl: fixRelative(h.thumbnailUrl),
    }));

    return {
      videoId: video._id.toString(),
      status: video.highlightStatus || 'HIGHLIGHTS_PENDING',
      clipCount: resolvedClips.length,
      clips: resolvedClips,
      generatedAt: video.highlightsGeneratedAt || null,
    };
  }

  /**
   * Get subtitle tracks for a video
   */
  async getSubtitles(videoId: string) {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const baseUrl = this.getBaseUrl();

    const tracks: {
      lang: string;
      url: string;
      label: string;
      isDefault: boolean;
    }[] = [];
    if (video.subtitles) {
      Object.entries(video.subtitles || {}).forEach(([lang, path]) => {
        const url = `${baseUrl}/${path}`;
        let label = lang;
        if (lang === 'en') label = 'English';
        if (lang === 'es') label = 'Spanish';
        if (lang === 'hi') label = 'Hindi';
        if (lang === 'fr') label = 'French';

        tracks.push({
          lang,
          url,
          label,
          isDefault: lang === 'en',
        });
      });
    }

    return {
      videoId: video._id.toString(),
      subtitleStatus: video.subtitleStatus || 'SUBTITLE_PENDING',
      accessibilityCompliant: video.accessibilityCompliant || false,
      tracks,
      subtitleGeneratedAt: video.subtitleGeneratedAt || null,
    };
  }

  /**
   * Regenerate highlights for a video - resets status and clears old clips.
   */
  async regenerateHighlights(videoId: string) {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.videosRepository.update(videoId, {
      highlightStatus: HighlightStatus.QUEUED,
      highlights: [],
      highlightsGeneratedAt: null,
      highlightsJsonPath: null,
    } as Partial<Video>);

    return {
      videoId: video._id.toString(),
      status: 'queued',
      message: 'Highlight regeneration has been queued',
    };
  }

  /**
   * Get sprite thumbnail info for seekbar preview.
   */
  async getSprites(videoId: string) {
    const video = await this.videosRepository.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const baseUrl = this.getBaseUrl();

    const fixLegacyUrl = (url: string | null) => {
      if (!url) return url;
      if (!url.startsWith('http')) return `${baseUrl}/${url}`;

      if (
        url.startsWith('https://storage.octanebrew.dev/vod/') &&
        !url.includes('openstream-uploads')
      ) {
        return url.replace(
          'storage.octanebrew.dev/vod/',
          'storage.octanebrew.dev/openstream-uploads/vod/',
        );
      }
      return url;
    };

    const s = video.sprites;

    const sprites = s
      ? {
          status: s.status,
          spriteUrl: fixLegacyUrl(s.spriteUrl),
          vttUrl: fixLegacyUrl(s.vttUrl),
          interval: s.interval,
          cols: s.cols,
          rows: s.rows,
          frameCount: s.frameCount,
          readyAt: s.readyAt,
        }
      : { status: 'PENDING' };

    return {
      videoId: video._id.toString(),
      sprites,
    };
  }

  // Helper methods

  private async formatVideoListItem(
    video: VideoDocument,
  ): Promise<VideoListItemDto> {
    const [user, commentsCount] = await Promise.all([
      this.usersRepository.findOne({ _id: video.userId.toString() }),
      this.commentsService.countByVideoId(video._id.toString()),
    ]);

    const baseUrl = this.getBaseUrl();
    const fixRelative = (url: string | undefined | null) => {
      if (!url) return '';
      return url.startsWith('http') ? url : `${baseUrl}/${url}`;
    };

    return {
      id: video._id.toString(),
      title: video.title,
      thumbnailUrl: fixRelative(video.thumbnailUrl || video.posterUrl),
      duration: this.formatDuration(video.duration),
      views: video.views,
      likes: video.likes,
      commentsCount,
      uploadedAt: this.formatRelativeTime(video.publishedAt || video.createdAt),
      isLive: video.isLive,
      visibility: video.visibility,
      creator: {
        username: (user as UserDoc)?.username || 'Unknown',
        avatarUrl: (user as UserDoc)?.avatar || '',
      },
      status: video.status,
      resolutions: video.encoding?.resolutions || [],
    };
  }

  private async formatVideoDetail(
    video: VideoDocument,
    user: UserDoc | null,
    channel: ChannelDocument | null,
    currentUserId?: string,
    liked: boolean = false,
    disliked: boolean = false,
  ): Promise<VideoDetailDto> {
    const commentsCount = await this.commentsService.countByVideoId(
      video._id.toString(),
    );

    const baseUrl = this.getBaseUrl();
    const fixRelative = (url: string | undefined | null) => {
      if (!url) return '';
      return url.startsWith('http') ? url : `${baseUrl}/${url}`;
    };

    return {
      id: video._id.toString(),
      title: video.title,
      description: video.description,
      thumbnailUrl: fixRelative(video.thumbnailUrl),
      posterUrl: fixRelative(video.posterUrl || video.thumbnailUrl),
      videoUrl: video.hlsManifest || video.videoUrl || '',
      duration: this.formatDuration(video.duration),
      views: video.views,
      likes: video.likes,
      dislikes: video.dislikes,
      commentsCount,
      uploadedAt: this.formatRelativeTime(video.publishedAt || video.createdAt),
      publishedAt: video.publishedAt?.toISOString() || '',
      visibility: video.visibility,
      category: video.category,
      isLive: video.isLive,
      creator: {
        username: user?.username || 'Unknown',
        avatarUrl: user?.avatar || '',
        subscribers: this.formatSubscribers(channel?.subscriberCount || 0),
        isVerified: false,
      },
      userInteraction: {
        liked,
        disliked,
        subscribed: false, // TODO: Check subscription status
      },
      resolutions: video.encoding?.resolutions || [],
      aiMetadata: video.aiMetadata || null,
    };
  }

  private formatDuration(seconds: number): string {
    const totalMinutes = Math.round(seconds / 60);

    if (totalMinutes === 0 && seconds > 0) {
      return '1 min';
    }

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (m === 0) {
      return `${h} h`;
    }

    return `${h} h ${m} min`;
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
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000)
      return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }
  private formatSubscribers(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  public getBaseUrl(): string {
    const publicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL');
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'openstream-uploads',
    );

    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${bucket}`;
    }

    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<string>('MINIO_PORT', '9000');

    if (!endpoint) return '';

    if (endpoint.startsWith('http')) {
      return `${endpoint.replace(/\/$/, '')}/${bucket}`;
    }

    const protocol = port === '443' ? 'https' : 'http';
    const portSuffix = port === '443' || port === '80' ? '' : `:${port}`;

    return `${protocol}://${endpoint}${portSuffix}/${bucket}`;
  }
}
