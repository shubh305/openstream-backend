import { Injectable } from '@nestjs/common';
import { VideosRepository } from '../videos/videos.repository';
import { ChannelsRepository } from '../channels/channels.repository';
import { UsersRepository } from '../users/users.repository';
import { StreamsRepository } from '../streams/streams.repository';
import { SemanticSearchService } from './semantic-search.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly videosRepository: VideosRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly streamsRepository: StreamsRepository,
    private readonly semanticSearchService: SemanticSearchService,
  ) {}

  /**
   * Search videos, channels, and active streams
   */
  async search(query: string, limit: number = 20) {
    if (!query || query.trim().length === 0) {
      return {
        results: { videos: [], channels: [], streams: [] },
        query: '',
        totalResults: 0,
      };
    }

    const [videos, channels, streams] = await Promise.all([
      this.videosRepository.search(query, Math.ceil(limit * 0.5)),
      this.channelsRepository.search(query, Math.ceil(limit * 0.3)),
      this.streamsRepository.search(query, Math.ceil(limit * 0.2)),
    ]);

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
          creator: {
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
        };
      }),
    );

    const formattedChannels = await Promise.all(
      channels.map(async (channel) => {
        const user = await this.usersRepository.findOne({
          _id: channel.userId.toString(),
        });

        return {
          id: channel._id.toString(),
          name: channel.name,
          handle: channel.handle,
          avatarUrl: user?.avatar || '',
          subscriberCount: channel.subscriberCount,
        };
      }),
    );

    const formattedStreams = await Promise.all(
      streams.map(async (stream) => {
        const user = await this.usersRepository.findOne({
          _id: stream.userId.toString(),
        });

        return {
          id: stream._id.toString(),
          title: stream.title,
          thumbnailUrl: stream.thumbnailUrl || '',
          viewerCount: stream.viewerCount,
          startedAt: this.formatRelativeTime(stream.startedAt || new Date()),
          status: stream.status,
          hlsPlaybackUrl: stream.hlsPlaybackUrl,
          category: stream.category || 'Just Chatting',
          streamer: {
            id: user?._id.toString(),
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
          creator: {
            id: user?._id.toString(),
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
        };
      }),
    );

    return {
      results: {
        videos: formattedVideos,
        channels: formattedChannels,
        streams: formattedStreams,
      },
      query,
      totalResults: videos.length + channels.length + streams.length,
    };
  }

  /**
   * AI-Powered Semantic Search (Hybrid)
   */
  async searchAI(query: string, limit: number = 20) {
    if (!query || query.trim().length === 0) {
      return {
        results: { videos: [], channels: [], streams: [] },
        query: '',
        totalResults: 0,
        isAI: true,
      };
    }

    // 1. Get Semantic results from Ingestion Service
    const semanticResults = await this.semanticSearchService.searchVideos(
      query,
      limit,
    );

    // 2. Fetch full creator details for these videos
    const formattedVideos = await Promise.all(
      semanticResults.map(async (item) => {
        const videoId = item.entity_id;
        const meta = item.metadata || {};

        const user = await this.usersRepository.findOne({
          _id: (meta.userId as string) || '',
        });

        return {
          id: videoId,
          title: item.title || (meta.title as string) || 'Untitled',
          thumbnailUrl: (meta.thumbnailUrl as string) || '',
          duration: this.formatDuration((meta.duration as number) || 0),
          views: (meta.views as number) || 0,
          uploadedAt: 'AI Match',
          matchedExcerpt: item.matched_chunk || '',
          score: item.score,
          isSemantic: true,
          keyMoments: meta.key_moments || [],
          entities: meta.entities || [],
          topic: meta.topic || null,
          creator: {
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
        };
      }),
    );

    // 3. Keep channels/streams from standard Mongo search as a fallback/hybrid layer
    const [channels, streams] = await Promise.all([
      this.channelsRepository.search(query, Math.ceil(limit * 0.3)),
      this.streamsRepository.search(query, Math.ceil(limit * 0.2)),
    ]);

    const formattedChannels = await Promise.all(
      channels.map(async (channel) => {
        const user = await this.usersRepository.findOne({
          _id: channel.userId.toString(),
        });

        return {
          id: channel._id.toString(),
          name: channel.name,
          handle: channel.handle,
          avatarUrl: user?.avatar || '',
          subscriberCount: channel.subscriberCount,
        };
      }),
    );

    const formattedStreams = await Promise.all(
      streams.map(async (stream) => {
        const user = await this.usersRepository.findOne({
          _id: stream.userId.toString(),
        });

        return {
          id: stream._id.toString(),
          title: stream.title,
          thumbnailUrl: stream.thumbnailUrl || '',
          viewerCount: stream.viewerCount,
          startedAt: this.formatRelativeTime(stream.startedAt || new Date()),
          status: stream.status,
          hlsPlaybackUrl: stream.hlsPlaybackUrl,
          category: stream.category || 'Just Chatting',
          streamer: {
            id: user?._id.toString(),
            username: user?.username || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
        };
      }),
    );

    return {
      results: {
        videos: formattedVideos,
        channels: formattedChannels,
        streams: formattedStreams,
      },
      query,
      totalResults:
        formattedVideos.length +
        formattedChannels.length +
        formattedStreams.length,
      isAI: true,
    };
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(query: string) {
    if (!query || query.trim().length < 2) {
      return { suggestions: [] };
    }

    // Get video titles that match
    const videos = await this.videosRepository.search(query, 5);
    const suggestions = videos.map((v) => v.title);

    // Also add channel names
    const channels = await this.channelsRepository.search(query, 3);
    suggestions.push(...channels.map((c) => c.name));

    // Remove duplicates and limit
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 8);

    return { suggestions: uniqueSuggestions };
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

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
