import { Injectable } from '@nestjs/common';
import { VideosRepository } from '../videos/videos.repository';
import { ChannelsRepository } from '../channels/channels.repository';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class SearchService {
  constructor(
    private readonly videosRepository: VideosRepository,
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Search videos and channels
   */
  async search(query: string, limit: number = 20) {
    if (!query || query.trim().length === 0) {
      return {
        results: { videos: [], channels: [] },
        query: '',
        totalResults: 0,
      };
    }

    const [videos, channels] = await Promise.all([
      this.videosRepository.search(query, Math.ceil(limit * 0.7)),
      this.channelsRepository.search(query, Math.ceil(limit * 0.3)),
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

    return {
      results: {
        videos: formattedVideos,
        channels: formattedChannels,
      },
      query,
      totalResults: videos.length + channels.length,
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
