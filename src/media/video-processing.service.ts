import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vod, VodDocument } from './schemas/vod.schema';
import * as path from 'path';
import { UsersRepository } from '../users/users.repository';
import { VideosRepository } from '../videos/videos.repository';
import { StreamsRepository } from '../streams/streams.repository';
import { ChannelsRepository } from '../channels/channels.repository';
import { VideoStatus, VideoVisibility } from '../videos/schemas/video.schema';

interface VideoPlayablePayload {
  videoId: string;
  hlsManifest480p: string;
  duration: number;
  thumbnailUrl: string;
}

interface VideoCompletePayload {
  videoId: string;
  hlsManifest: string;
  resolutions: string[];
  crf: number;
  complexityScore: number;
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    @Inject('WORKER_SERVICE') private readonly workerClient: ClientKafka,
    @InjectModel(Vod.name) private readonly vodModel: Model<VodDocument>,
    private readonly usersRepository: UsersRepository,
    private readonly videosRepository: VideosRepository,
    private readonly streamsRepository: StreamsRepository,
    private readonly channelsRepository: ChannelsRepository,
  ) {}

  async onModuleInit() {
    await this.workerClient.connect();
  }

  async processAndSaveVideo(streamKey: string, filename: string) {
    this.logger.log(`Starting post-processing for stream: ${streamKey}`);

    try {
      const user = await this.usersRepository.findByStreamKey(streamKey);
      if (!user) {
        this.logger.error(`User not found for stream key: ${streamKey}`);
        return;
      }

      const channel = await this.channelsRepository.findByUserId(
        user._id.toString(),
      );
      if (!channel) {
        this.logger.error(
          `Channel not found for user: ${user._id.toString()} (streamKey: ${streamKey})`,
        );
        return;
      }

      const streamInfo = await this.streamsRepository.findByUserId(
        user._id.toString(),
      );

      const videoId = new Types.ObjectId();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.videosRepository.create({
        _id: videoId,
        userId: user._id,
        channelId: channel._id,
        title: streamInfo?.title || `Live Replay ${new Date().toDateString()}`,
        description:
          streamInfo?.description ||
          `Recorded live stream from ${new Date().toLocaleString()}`,
        status: VideoStatus.PROCESSING,
        visibility: streamInfo?.visibility || VideoVisibility.PRIVATE,
        category: streamInfo?.category || 'Other',
        isLive: true,
        encoding: {
          crf: 0,
          complexityScore: 0,
          resolutions: [],
        },
      } as any);

      this.logger.log(
        `Created Video record ${videoId.toString()} for stream ${streamKey}. Dispatching jobs...`,
      );

      const payload = {
        videoId: videoId.toString(),
        ownerId: user._id.toString(),
        sessionId: streamKey,
        storagePath: path.basename(filename),
        sizeBytes: 0,
        originalFilename: filename,
        ts: Date.now(),
        bucket: 'recordings',
      };

      this.workerClient.emit('vod.transcode.fast', payload);
      this.workerClient.emit('vod.transcode.slow', payload);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to initialize video processing: ${error.message}`,
        error.stack,
      );
    }
  }

  async handlePlayable(payload: VideoPlayablePayload) {
    const { videoId, hlsManifest480p, duration, thumbnailUrl } = payload;
    this.logger.log(`Video ${videoId} is playable (Fast Lane)`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.videosRepository.update(videoId, {
      status: VideoStatus.PLAYABLE,
      playableAt: new Date(),
      hlsManifest: hlsManifest480p,
      duration,
      thumbnailUrl,
      'encoding.resolutions': ['480p'],
    } as any);
  }

  async handleComplete(payload: VideoCompletePayload) {
    const { videoId, hlsManifest, resolutions, crf, complexityScore } = payload;
    this.logger.log(`Video ${videoId} processing complete (Slow Lane)`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.videosRepository.update(videoId, {
      status: VideoStatus.COMPLETE,
      completeAt: new Date(),
      hlsManifest,
      'encoding.resolutions': resolutions,
      'encoding.crf': crf,
      'encoding.complexityScore': complexityScore,
    } as any);
  }

  /**
   * @deprecated Legacy Handler
   */
  async handleProcessedVideo(payload: {
    streamKey: string;
    filename: string;
    path: string;
    thumbnail: string;
    duration: number;
  }) {
    this.logger.warn(
      `Legacy handleProcessedVideo called for ${payload.filename}`,
    );
    return Promise.resolve();
  }
}
