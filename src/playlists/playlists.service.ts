import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Playlist,
  PlaylistDocument,
  PlaylistVisibility,
} from './schemas/playlist.schema';
import {
  PlaylistItem,
  PlaylistItemDocument,
} from './schemas/playlist-item.schema';
import { ChannelsRepository } from '../channels/channels.repository';
import { UsersRepository } from '../users/users.repository';
import { VideosRepository } from '../videos/videos.repository';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectModel(Playlist.name) private playlistModel: Model<PlaylistDocument>,
    @InjectModel(PlaylistItem.name)
    private playlistItemModel: Model<PlaylistItemDocument>,
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly videosRepository: VideosRepository,
  ) {}

  /**
   * Get user's playlists
   */
  async getUserPlaylists(userId: string, videoId?: string) {
    const playlists = await this.playlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();

    return Promise.all(
      playlists.map(async (p) => {
        const formatted = await this.formatPlaylistWithThumb(p);

        if (videoId && Types.ObjectId.isValid(videoId)) {
          const itemInPlaylist = await this.playlistItemModel
            .findOne({
              playlistId: p._id,
              videoId: new Types.ObjectId(videoId),
            })
            .exec();

          return {
            ...formatted,
            includesVideo: !!itemInPlaylist,
          };
        }

        return formatted;
      }),
    );
  }

  /**
   * Get channel's public playlists
   */
  async getChannelPlaylists(channelId: string) {
    if (!Types.ObjectId.isValid(channelId)) {
      return [];
    }

    const playlists = await this.playlistModel
      .find({
        channelId: new Types.ObjectId(channelId),
        visibility: PlaylistVisibility.PUBLIC,
        isWatchLater: false,
      })
      .sort({ updatedAt: -1 })
      .exec();

    return Promise.all(playlists.map((p) => this.formatPlaylistWithThumb(p)));
  }

  /**
   * Get playlist by ID with videos
   */
  async getPlaylistById(id: string, userId?: string) {
    const playlist = await this.playlistModel.findById(id).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    // Check visibility
    const isOwner = userId && playlist.userId.toString() === userId;
    if (playlist.visibility === PlaylistVisibility.PRIVATE && !isOwner) {
      throw new ForbiddenException('This playlist is private');
    }

    // Get videos
    const items = await this.playlistItemModel
      .find({ playlistId: playlist._id })
      .sort({ order: 1 })
      .exec();

    const videos = await Promise.all(
      items.map(async (item) => {
        const video = await this.videosRepository.findById(
          item.videoId.toString(),
        );
        if (!video) return null;

        const [channel, user] = await Promise.all([
          this.channelsRepository.findById(video.channelId.toString()),
          this.usersRepository.findOne({ _id: video.userId.toString() }),
        ]);

        return {
          id: video._id.toString(),
          title: video.title,
          thumbnailUrl: video.thumbnailUrl || '',
          duration: this.formatDuration(video.duration),
          channelName: channel?.name || 'Unknown',
          creator: {
            username: channel?.name || 'Unknown',
            avatarUrl: user?.avatar || '',
          },
          order: item.order,
        };
      }),
    );

    const user = await this.usersRepository.findOne({
      _id: playlist.userId.toString(),
    });

    return {
      ...this.formatPlaylist(playlist),
      owner: {
        username: user?.username || 'Unknown',
        avatarUrl: user?.avatar || '',
      },
      videos: videos.filter(Boolean),
    };
  }

  /**
   * Create playlist
   */
  async createPlaylist(
    userId: string,
    title: string,
    description?: string,
    visibility: PlaylistVisibility = PlaylistVisibility.PRIVATE,
  ) {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const playlist = await this.playlistModel.create({
      userId: new Types.ObjectId(userId),
      channelId: channel._id,
      title,
      description: description || null,
      visibility,
      videoCount: 0,
      isWatchLater: false,
    });

    return this.formatPlaylist(playlist);
  }

  /**
   * Update playlist
   */
  async updatePlaylist(
    id: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      visibility?: PlaylistVisibility;
    },
  ) {
    const playlist = await this.playlistModel.findById(id).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own playlists');
    }

    Object.assign(playlist, updates);
    await playlist.save();

    return this.formatPlaylist(playlist);
  }

  /**
   * Delete playlist
   */
  async deletePlaylist(id: string, userId: string): Promise<void> {
    const playlist = await this.playlistModel.findById(id).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own playlists');
    }

    // Delete all items
    await this.playlistItemModel
      .deleteMany({ playlistId: playlist._id })
      .exec();
    await playlist.deleteOne();
  }

  /**
   * Add video to playlist
   */
  async addVideo(
    playlistId: string,
    videoId: string,
    userId: string,
  ): Promise<void> {
    const playlist = await this.playlistModel.findById(playlistId).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId.toString() !== userId) {
      throw new ForbiddenException('You can only modify your own playlists');
    }

    // Get next order number
    const lastItem = await this.playlistItemModel
      .findOne({ playlistId: playlist._id })
      .sort({ order: -1 })
      .exec();
    const nextOrder = lastItem ? lastItem.order + 1 : 0;

    await this.playlistItemModel.create({
      playlistId: playlist._id,
      videoId: new Types.ObjectId(videoId),
      order: nextOrder,
    });

    playlist.videoCount += 1;
    await playlist.save();
  }

  /**
   * Remove video from playlist
   */
  async removeVideo(
    playlistId: string,
    videoId: string,
    userId: string,
  ): Promise<void> {
    const playlist = await this.playlistModel.findById(playlistId).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId.toString() !== userId) {
      throw new ForbiddenException('You can only modify your own playlists');
    }

    const result = await this.playlistItemModel
      .findOneAndDelete({
        playlistId: playlist._id,
        videoId: new Types.ObjectId(videoId),
      })
      .exec();

    if (result) {
      playlist.videoCount -= 1;
      await playlist.save();
    }
  }

  /**
   * Reorder videos in playlist
   */
  async reorderVideos(
    playlistId: string,
    videoOrder: { videoId: string; order: number }[],
    userId: string,
  ): Promise<void> {
    const playlist = await this.playlistModel.findById(playlistId).exec();
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    if (playlist.userId.toString() !== userId) {
      throw new ForbiddenException('You can only modify your own playlists');
    }

    for (const item of videoOrder) {
      await this.playlistItemModel
        .findOneAndUpdate(
          {
            playlistId: playlist._id,
            videoId: new Types.ObjectId(item.videoId),
          },
          { order: item.order },
        )
        .exec();
    }
  }

  /**
   * Get watch later playlist
   */
  async getWatchLater(userId: string) {
    let playlist = await this.playlistModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isWatchLater: true,
      })
      .exec();

    if (!playlist) {
      // Create watch later playlist
      const channel = await this.channelsRepository.findByUserId(userId);
      playlist = await this.playlistModel.create({
        userId: new Types.ObjectId(userId),
        channelId: channel?._id || new Types.ObjectId(userId),
        title: 'Watch Later',
        description: null,
        visibility: PlaylistVisibility.PRIVATE,
        videoCount: 0,
        isWatchLater: true,
      });
    }

    return this.getPlaylistById(playlist._id.toString(), userId);
  }

  /**
   * Add to watch later
   */
  async addToWatchLater(videoId: string, userId: string): Promise<void> {
    const watchLater = await this.getOrCreateWatchLater(userId);
    await this.addVideo(watchLater._id.toString(), videoId, userId);
  }

  /**
   * Remove from watch later
   */
  async removeFromWatchLater(videoId: string, userId: string): Promise<void> {
    const watchLater = await this.getOrCreateWatchLater(userId);
    await this.removeVideo(watchLater._id.toString(), videoId, userId);
  }

  private async getOrCreateWatchLater(
    userId: string,
  ): Promise<PlaylistDocument> {
    let playlist = await this.playlistModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isWatchLater: true,
      })
      .exec();

    if (!playlist) {
      const channel = await this.channelsRepository.findByUserId(userId);
      playlist = await this.playlistModel.create({
        userId: new Types.ObjectId(userId),
        channelId: channel?._id || new Types.ObjectId(userId),
        title: 'Watch Later',
        description: null,
        visibility: PlaylistVisibility.PRIVATE,
        videoCount: 0,
        isWatchLater: true,
      });
    }

    return playlist;
  }

  private async formatPlaylistWithThumb(playlist: PlaylistDocument) {
    const base = this.formatPlaylist(playlist);

    // Get first video thumbnail
    const firstItem = await this.playlistItemModel
      .findOne({ playlistId: playlist._id })
      .sort({ order: 1 })
      .exec();

    if (firstItem) {
      const video = await this.videosRepository.findById(
        firstItem.videoId.toString(),
      );
      if (video) {
        base.thumbnailUrl = video.thumbnailUrl || '';
      }
    }

    return base;
  }

  private formatPlaylist(playlist: PlaylistDocument) {
    return {
      id: playlist._id.toString(),
      title: playlist.title,
      description: playlist.description,
      visibility: playlist.visibility,
      videoCount: playlist.videoCount,
      thumbnailUrl: '',
      updatedAt: this.formatRelativeTime(playlist.updatedAt),
    };
  }

  private formatDuration(seconds: number): string {
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return 'Updated today';
    if (diffInDays === 1) return 'Updated yesterday';
    if (diffInDays < 7) return `Updated ${diffInDays} days ago`;
    return `Updated ${Math.floor(diffInDays / 7)} weeks ago`;
  }
}
