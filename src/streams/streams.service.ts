import {
  Injectable,
  NotFoundException,
  ConflictException,
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
   */
  async onPublishStart(streamKey: string): Promise<void> {
    const user = await this.usersRepository.findByStreamKey(
      streamKey.replace('sk_live_', ''),
    );
    if (!user) {
      return;
    }

    await this.streamsRepository.setStatus(
      user._id.toString(),
      StreamStatus.LIVE,
    );
  }

  /**
   * Called when RTMP publish ends (from webhook)
   */
  async onPublishEnd(streamKey: string): Promise<void> {
    const user = await this.usersRepository.findByStreamKey(
      streamKey.replace('sk_live_', ''),
    );
    if (!user) {
      return;
    }

    await this.streamsRepository.setStatus(
      user._id.toString(),
      StreamStatus.OFFLINE,
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

    return {
      id: stream._id.toString(),
      userId: stream.userId.toString(),
      title: stream.title,
      category: stream.category,
      visibility: stream.visibility,
      status: stream.status,
      thumbnailUrl: stream.thumbnailUrl,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt?.toISOString() || null,
      latencyMode: stream.latencyMode,
      creator: {
        username: user?.username || 'Unknown',
        avatarUrl: user?.avatar || '',
      },
    };
  }
}
