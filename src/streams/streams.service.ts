import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { StreamsRepository } from './streams.repository';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from '../auth/auth.service';
import {
  UpdateStreamSettingsDto,
  StreamResponseDto,
  StreamKeyResponseDto,
  StreamListResponseDto,
} from './dto/webhook.dto';
import { StreamDocument, StreamStatus } from './schemas/stream.schema';

@Injectable()
export class StreamsService {
  private readonly logger = new Logger(StreamsService.name);

  constructor(
    private readonly streamsRepository: StreamsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get all active (live) streams
   */
  async getLiveStreams(): Promise<StreamListResponseDto> {
    const streams = await this.streamsRepository.findAllActive();
    const formattedStreams = await Promise.all(
      streams.map((stream) => this.formatStreamResponse(stream)),
    );

    return {
      streams: formattedStreams,
      total: streams.length,
    };
  }

  /**
   * Get stream by ID
   */
  async getStreamById(id: string): Promise<StreamResponseDto> {
    const stream = await this.streamsRepository.findById(id);
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }

    return this.formatStreamResponse(stream);
  }

  /**
   * Get current user's stream
   */
  async getMyStream(userId: string): Promise<StreamResponseDto> {
    const stream = await this.streamsRepository.findByUserId(userId);
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    return this.formatStreamResponse(stream);
  }

  /**
   * Get user's stream key and RTMP info
   */
  async getStreamKey(userId: string): Promise<StreamKeyResponseDto> {
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const rtmpUrl = this.configService.get<string>(
      'RTMP_INGEST_URL',
      'rtmp://localhost:1935/live',
    );
    const wsUrl = rtmpUrl
      .replace('rtmp://', 'wss://')
      .replace('/live', '/ws/ingest');

    // Format stream key as sk_live_xxxx
    const formattedKey = user.streamKey.startsWith('sk_live_')
      ? user.streamKey
      : `sk_live_${user.streamKey}`;

    return {
      streamKey: formattedKey,
      rtmpUrl,
      wsUrl,
    };
  }

  /**
   * Regenerate stream key
   */
  async regenerateStreamKey(userId: string): Promise<StreamKeyResponseDto> {
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newKey = await this.authService.regenerateStreamKey(user.username);

    const rtmpUrl = this.configService.get<string>(
      'RTMP_INGEST_URL',
      'rtmp://localhost:1935/live',
    );
    const wsUrl = rtmpUrl
      .replace('rtmp://', 'wss://')
      .replace('/live', '/ws/ingest');

    return {
      streamKey: `sk_live_${newKey}`,
      rtmpUrl,
      wsUrl,
    };
  }

  /**
   * Update stream settings
   */
  async updateSettings(
    userId: string,
    settings: UpdateStreamSettingsDto,
  ): Promise<StreamResponseDto> {
    let stream = await this.streamsRepository.findByUserId(userId);

    if (!stream) {
      // Create default stream settings
      stream = await this.streamsRepository.create({
        userId: new Types.ObjectId(userId),
        title: settings.title || 'Untitled Stream',
        description: settings.description || '',
        category: settings.category,
        visibility: settings.visibility,
        latencyMode: settings.latencyMode,
        status: StreamStatus.OFFLINE,
      });
    } else {
      stream = await this.streamsRepository.updateByUserId(userId, settings);
    }

    return this.formatStreamResponse(stream!);
  }

  /**
   * Start a live stream session
   */
  async goLive(userId: string): Promise<StreamResponseDto> {
    const activeStream =
      await this.streamsRepository.findActiveByUserId(userId);
    if (activeStream) {
      throw new ConflictException('You already have an active stream');
    }

    let stream = await this.streamsRepository.findByUserId(userId);

    if (!stream) {
      // Create new stream
      stream = await this.streamsRepository.create({
        userId: new Types.ObjectId(userId),
        status: StreamStatus.STARTING,
        startedAt: new Date(),
      });
    } else {
      stream = await this.streamsRepository.setStatus(
        userId,
        StreamStatus.STARTING,
      );
    }

    return this.formatStreamResponse(stream!);
  }

  /**
   * End current stream
   */
  async endStream(userId: string): Promise<StreamResponseDto> {
    const stream = await this.streamsRepository.findActiveByUserId(userId);
    if (!stream) {
      throw new NotFoundException('No active stream found');
    }

    const updatedStream = await this.streamsRepository.setStatus(
      userId,
      StreamStatus.OFFLINE,
    );

    return this.formatStreamResponse(updatedStream!);
  }

  /**
   * Called when RTMP publish starts (from webhook)
   * Implements stream takeover: if user already has an active stream,
   * end it first before starting the new one.
   */
  async onPublishStart(streamKey: string): Promise<void> {
    const cleanKey = streamKey.replace('sk_live_', '');
    const user = await this.usersRepository.findByStreamKey(cleanKey);
    if (!user) {
      this.logger.error(`[onPublishStart] User not found for key: ${cleanKey}`);
      return;
    }

    const userId = user._id.toString();
    this.logger.log(
      `[onPublishStart] Stream starting for user ${user.username} (${userId})`,
    );

    const existingStream =
      await this.streamsRepository.findActiveByUserId(userId);
    if (existingStream) {
      await this.streamsRepository.setStatus(userId, StreamStatus.OFFLINE);
      this.logger.log(
        `[StreamTakeover] Ended existing stream for user ${user.username} before starting new one`,
      );
    }

    await this.streamsRepository.setStatusWithStreamKey(
      userId,
      StreamStatus.LIVE,
      cleanKey,
    );
  }

  /**
   * Called when RTMP publish ends (from webhook)
   */
  async onPublishEnd(streamKey: string): Promise<void> {
    const cleanKey = streamKey.replace('sk_live_', '');
    const user = await this.usersRepository.findByStreamKey(cleanKey);
    if (!user) {
      this.logger.error(`[onPublishEnd] User not found for key: ${cleanKey}`);
      return;
    }

    this.logger.log(
      `[onPublishEnd] Stream ending for user ${user.username} (${user._id.toString()})`,
    );

    await this.streamsRepository.setStatusWithStreamKey(
      user._id.toString(),
      StreamStatus.OFFLINE,
      null,
    );
  }

  /**
   * Format stream document to response DTO
   */
  private async formatStreamResponse(
    stream: StreamDocument,
  ): Promise<StreamResponseDto> {
    const user = await this.usersRepository.findOne({
      _id: stream.userId.toString(),
    });

    // Construct HLS playback URL if stream is live
    let hlsPlaybackUrl: string | null = null;
    if (stream.status === StreamStatus.LIVE) {
      const streamKey = stream.streamKey || user?.streamKey;
      if (streamKey) {
        const hlsBaseUrl = this.configService.get<string>(
          'HLS_PLAYBACK_BASE_URL',
          'https://octanebrew.dev/video/live',
        );
        hlsPlaybackUrl = `${hlsBaseUrl}/${streamKey}.m3u8`;
      }
    }

    return {
      id: stream._id.toString(),
      userId: stream.userId.toString(),
      title: stream.title,
      description: stream.description || '',
      category: stream.category,
      visibility: stream.visibility,
      status: stream.status,
      thumbnailUrl: stream.thumbnailUrl,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt?.toISOString() || null,
      latencyMode: stream.latencyMode,
      hlsPlaybackUrl,
      creator: {
        username: user?.username || 'Unknown',
        avatarUrl: user?.avatar || '',
      },
    };
  }
}
