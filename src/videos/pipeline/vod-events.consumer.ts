import { Controller, Logger, Inject } from '@nestjs/common';
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
  ClientKafka,
} from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Types, Model, UpdateQuery } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { StorageService } from '../../storage/storage.service';
import {
  Video,
  VideoDocument,
  VideoStatus,
  HighlightStatus,
  SubtitleStatus,
  SpriteStatus,
  HighlightClip,
} from '../schemas/video.schema';
import {
  Clip,
  ClipDocument,
  ClipStatus,
} from '../../clips/schemas/clip.schema';
import type {
  VideoPlayableEvent,
  VideoCompleteEvent,
  VideoHighlightRequestEvent,
  VideoHighlightCompleteEvent,
  VideoHighlightDegradedEvent,
  VideoHighlightFailedEvent,
  VideoSubtitleCompleteEvent,
  VideoSubtitleDegradedEvent,
  VideoSubtitleFailedEvent,
  VideoSpritesCompleteEvent,
} from '../events/pipeline-events';
import { PIPELINE_TOPICS } from '../events/pipeline-events';
import {
  CLIP_TOPICS,
  ClipTranscodeEvent,
} from '../../clips/events/clip-events.types';
import { VodSocketGateway } from './vod-socket.gateway';

@Controller()
export class VodEventsConsumer {
  private readonly logger = new Logger(VodEventsConsumer.name);

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    @InjectModel(Clip.name) private readonly clipModel: Model<ClipDocument>,
    private readonly socketGateway: VodSocketGateway,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly httpService: HttpService,
    @Inject('VOD_WORKER_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {
    this.logger.log(
      'VodEventsConsumer initialized and listening for Kafka events',
    );
  }

  // ─────────────────────────────────────────────────────────
  //  Fast Lane → PLAYABLE
  // ─────────────────────────────────────────────────────────

  /**
   * Kafka consumer for `video.playable` events.
   * Fired by FFmpeg Worker fast lane when 480p HLS is ready.
   * Updates the Video document and pushes real-time status via WebSocket.
   */
  @EventPattern('video.playable')
  async handleVideoPlayable(
    @Payload() message: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    const topic = context.getTopic();
    this.logger.log(`Incoming message on topic: ${topic}`);
    this.logger.debug(`RAW payload: ${JSON.stringify(message)}`);

    const payload = (message.value ?? message) as VideoPlayableEvent;

    if (!payload.videoId) {
      this.logger.error(`Received message on ${topic} without videoId!`);
      return;
    }

    this.logger.log(`Processing video.playable for ${payload.videoId}`);

    if (!payload.hlsManifest480p) {
      this.logger.warn(
        `video.playable for ${payload.videoId} has no manifest — possible error`,
      );
      return;
    }

    const updateValues: Record<string, unknown> = {
      status: VideoStatus.PLAYABLE,
      playableAt: new Date(),
      'encoding.resolutions': payload.resolutions || ['480p'],
    };

    if (payload.hlsManifest480p) {
      updateValues.hlsManifest = payload.hlsManifest480p;
    }
    if (payload.thumbnailUrl) {
      updateValues.thumbnailUrl = payload.thumbnailUrl;
    }
    if (payload.duration) {
      updateValues.duration = payload.duration;
    }

    const update: UpdateQuery<VideoDocument> = { $set: updateValues };

    const filter = {
      _id: new Types.ObjectId(payload.videoId),
      status: { $ne: VideoStatus.COMPLETE },
    };

    const updatedDoc = await this.videoModel.findOneAndUpdate(filter, update, {
      new: true,
    });

    if (updatedDoc) {
      this.socketGateway.notifyVideoStatus(payload.videoId, {
        status: VideoStatus.PLAYABLE,
        hlsManifest: payload.hlsManifest480p,
        thumbnailUrl: payload.thumbnailUrl,
        duration: payload.duration,
        resolutions: payload.resolutions || ['480p'],
      });
      this.logger.log(`Video ${payload.videoId} is now PLAYABLE`);
    } else {
      this.logger.log(
        `Video ${payload.videoId} was already COMPLETE or not found. Skipping PLAYABLE update.`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Slow Lane → COMPLETE + Highlight Dispatch
  // ─────────────────────────────────────────────────────────

  /**
   * Kafka consumer for `video.complete` events.
   * Fired by FFmpeg Worker slow lane when all resolutions are done.
   * Also dispatches a highlight generation request if enabled.
   */
  @EventPattern('video.complete')
  async handleVideoComplete(
    @Payload() message: Record<string, unknown>,
    @Ctx() context: KafkaContext,
  ) {
    const topic = context.getTopic();
    this.logger.log(`Incoming message on topic: ${topic}`);
    this.logger.debug(`RAW payload: ${JSON.stringify(message)}`);

    const payload = (message.value ?? message) as VideoCompleteEvent;

    if (!payload.videoId) {
      this.logger.error(`Received message on ${topic} without videoId!`);
      return;
    }

    this.logger.log(`Processing video.complete for ${payload.videoId}`);

    const updateValues: Record<string, unknown> = {
      status: VideoStatus.COMPLETE,
      completeAt: new Date(),
      'encoding.crf': payload.crfUsed,
      'encoding.complexityScore': payload.complexityScore,
      'encoding.resolutions': payload.resolutions,
    };

    if (payload.hlsManifest) {
      updateValues.hlsManifest = payload.hlsManifest;
    }

    if (payload.thumbnailUrl) {
      updateValues.thumbnailUrl = payload.thumbnailUrl;
    }

    const update: UpdateQuery<VideoDocument> = { $set: updateValues };

    await this.videoModel.findByIdAndUpdate(payload.videoId, update);

    this.socketGateway.notifyVideoStatus(payload.videoId, {
      status: VideoStatus.COMPLETE,
      hlsManifest: payload.hlsManifest,
      thumbnailUrl: payload.thumbnailUrl,
      resolutions: payload.resolutions,
    });

    this.logger.log(`Video ${payload.videoId} is now COMPLETE`);

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: { 'sprites.status': SpriteStatus.PENDING },
    });

    // Dispatch highlight generation if enabled
    const isFinalPass = payload.resolutions?.includes('1080p');
    if (isFinalPass) {
      await this.dispatchHighlightRequest(payload);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  SPRITE THUMBNAILS
  // ─────────────────────────────────────────────────────────

  @EventPattern('video.sprites.complete')
  async handleSpritesComplete(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoSpritesCompleteEvent;

    if (!payload.videoId) {
      this.logger.error('video.sprites.complete received without videoId');
      return;
    }

    if (payload.failed) {
      this.logger.warn(
        `Sprites FAILED for ${payload.videoId}: ${payload.reason}`,
      );
      await this.videoModel.findByIdAndUpdate(payload.videoId, {
        $set: { 'sprites.status': SpriteStatus.FAILED },
      });
      return;
    }

    const spriteUrl = payload.spritePath;
    const vttUrl = payload.vttPath;

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: {
        sprites: {
          status: SpriteStatus.READY,
          spriteUrl,
          vttUrl,
          interval: payload.interval ?? null,
          cols: payload.cols ?? null,
          rows: payload.rows ?? null,
          frameCount: payload.frameCount ?? null,
          readyAt: new Date(),
        },
      },
    });

    const publicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL');
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'openstream-uploads',
    );

    let baseUrl = '';
    if (publicUrl) {
      baseUrl = `${publicUrl.replace(/\/$/, '')}/${bucket}`;
    } else {
      const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const port = this.configService.get<string>('MINIO_PORT', '9000');

      if (endpoint) {
        if (endpoint.startsWith('http')) {
          baseUrl = `${endpoint.replace(/\/$/, '')}/${bucket}`;
        } else {
          const protocol = port === '443' ? 'https' : 'http';
          const portSuffix = port === '443' || port === '80' ? '' : `:${port}`;
          baseUrl = `${protocol}://${endpoint}${portSuffix}/${bucket}`;
        }
      }
    }
    const fullVttUrl = `${baseUrl}/${vttUrl}`;

    this.socketGateway.notifyVideoStatus(payload.videoId, {
      status: 'sprite:ready',
      vttUrl: fullVttUrl,
    });

    this.logger.log(
      `Sprites READY for ${payload.videoId}: ${payload.frameCount} frames`,
    );
  }

  // ─────────────────────────────────────────────────────────
  //  HIGHLIGHT GENERATOR: Completion Events
  // ─────────────────────────────────────────────────────────

  @EventPattern('video.highlights.complete')
  async handleHighlightComplete(@Payload() message: Record<string, unknown>) {
    await this.processHighlightPayload(
      message,
      HighlightStatus.COMPLETE,
      'HIGHLIGHTS_COMPLETE',
    );
  }

  @EventPattern('video.highlights.degraded')
  async handleHighlightDegraded(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoHighlightDegradedEvent;
    if (payload.warnings) {
      this.logger.warn(
        `Highlight DEGRADED for ${payload.videoId}: ${payload.warnings.join(', ')}`,
      );
    }
    await this.processHighlightPayload(
      message,
      HighlightStatus.DEGRADED,
      'HIGHLIGHTS_DEGRADED',
    );
  }

  private async processHighlightPayload(
    message: Record<string, unknown>,
    targetStatus: HighlightStatus,
    socketStatus: string,
  ) {
    const payload = (message.value ?? message) as VideoHighlightCompleteEvent;

    if (!payload.videoId) {
      this.logger.error(`video.highlights event without videoId`);
      return;
    }

    this.logger.log(
      `Highlight ${targetStatus} for ${payload.videoId}: ${payload.clipCount || 0} clips`,
    );

    let highlights: HighlightClip[] = [];
    const volPath = this.configService.get<string>(
      'OPENSTREAM_VOL_PATH',
      '/minio_data',
    );
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'openstream-uploads',
    );
    try {
      if (payload.highlightsJsonPath) {
        const fullPath = path.join(volPath, bucket, payload.highlightsJsonPath);
        try {
          const jsonStr = await fs.readFile(fullPath, 'utf-8');
          highlights = JSON.parse(jsonStr) as HighlightClip[];
          this.logger.log(`Ready highlights from local path: ${fullPath}`);
        } catch {
          this.logger.warn(
            `Local file read failed, falling back to S3: ${payload.highlightsJsonPath}`,
          );
          const url = await this.storageService.getPresignedUrl(
            bucket,
            payload.highlightsJsonPath,
          );
          if (url) {
            const response = await lastValueFrom(this.httpService.get(url));
            highlights = (
              typeof response.data === 'string'
                ? JSON.parse(response.data)
                : response.data
            ) as HighlightClip[];
            this.logger.log(`Ready highlights successfully from S3 fallback`);
          } else {
            throw new Error(
              `Could not generate presigned URL for ${payload.highlightsJsonPath}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to read highlights file (local & s3 fallback): ${String(err)}`,
      );
    }

    const video = await this.videoModel.findById(payload.videoId);
    const crfValue = video?.encoding?.crf || 23;
    const clipIds: string[] = [];

    for (const h of highlights) {
      const clipId = nanoid();
      clipIds.push(clipId);

      let rawPath = h.clipUrl || '';
      if (rawPath.includes(bucket)) {
        const rawPathMatch = rawPath.match(new RegExp(`${bucket}/(.+)$`));
        if (rawPathMatch) rawPath = rawPathMatch[1];
      }

      if (!rawPath) {
        rawPath = `highlights/${payload.videoId}/clip_${h.index.toString().padStart(3, '0')}.mp4`;
      }

      await this.clipModel.create({
        clipId,
        parentVideoId: video?._id,
        ownerId: video?.userId,
        title: h.title || `Highlight at ${Math.floor(h.start)}s`,
        start: h.start,
        end: h.end,
        duration: h.end - h.start,
        score: h.score,
        signals: {
          audio: !!h.signals?.audio,
          scene: !!h.signals?.scene,
          chat: !!h.signals?.chat,
          ocr: !!h.signals?.ocr,
        },
        status: ClipStatus.PROCESSING,
        rawPath,
        thumbnailUrl:
          h.thumbnailUrl ||
          `highlights/${payload.videoId}/thumb_${h.index.toString().padStart(3, '0')}.jpg`,
      });

      const transcodeEvent: ClipTranscodeEvent = {
        clipId,
        parentVideoId: payload.videoId,
        rawPath,
        crfValue,
        ts: Date.now(),
      };

      this.kafkaClient.emit(CLIP_TOPICS.TRANSCODE_REQUEST, transcodeEvent);
    }

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: {
        highlightStatus: targetStatus,
        highlightsGeneratedAt: new Date(),
        highlightsJsonPath: payload.highlightsJsonPath,
        highlights,
      },
      $addToSet: { clips: { $each: clipIds } },
    });

    this.socketGateway.notifyVideoStatus(payload.videoId, {
      status: socketStatus,
    });
  }

  @EventPattern('video.highlights.failed')
  async handleHighlightFailed(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoHighlightFailedEvent;

    if (!payload.videoId) return;

    this.logger.error(
      `Highlight FAILED for ${payload.videoId}: ${payload.error}`,
    );

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: { highlightStatus: HighlightStatus.FAILED },
    });

    this.socketGateway.notifyVideoStatus(payload.videoId, {
      status: 'HIGHLIGHTS_FAILED',
    });
  }

  // ─────────────────────────────────────────────────────────
  //  SUBTITLE PIPELINE: Completion Events
  // ─────────────────────────────────────────────────────────

  @EventPattern('video.subtitle.complete')
  async handleSubtitleComplete(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoSubtitleCompleteEvent;

    if (!payload.videoId) return;

    this.logger.log(
      `Subtitle COMPLETE for ${payload.videoId}: ${payload.tracks.map((t) => t.lang).join(', ')}`,
    );

    const subtitleUpdate: Record<string, string> = {};
    for (const track of payload.tracks) {
      subtitleUpdate[`subtitles.${track.lang}`] = track.path;
    }

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: {
        ...subtitleUpdate,
        subtitleStatus: SubtitleStatus.COMPLETE,
        subtitleGeneratedAt: new Date(),
        accessibilityCompliant: true,
      },
    });

    this.socketGateway.notifyVideoStatus(payload.videoId, {
      status: 'SUBTITLE_COMPLETE',
    });
  }

  @EventPattern('video.subtitle.degraded')
  async handleSubtitleDegraded(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoSubtitleDegradedEvent;

    if (!payload.videoId) return;

    this.logger.warn(
      `Subtitle DEGRADED for ${payload.videoId}: failed langs: ${payload.failedLangs.join(', ')}`,
    );

    const subtitleUpdate: Record<string, string> = {};
    for (const track of payload.tracks) {
      subtitleUpdate[`subtitles.${track.lang}`] = track.path;
    }

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: {
        ...subtitleUpdate,
        subtitleStatus: SubtitleStatus.DEGRADED,
        subtitleGeneratedAt: new Date(),
        accessibilityCompliant: true,
      },
    });
  }

  @EventPattern('video.subtitle.failed')
  async handleSubtitleFailed(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoSubtitleFailedEvent;

    if (!payload.videoId) return;

    this.logger.error(
      `Subtitle FAILED for ${payload.videoId}: ${payload.error}`,
    );

    await this.videoModel.findByIdAndUpdate(payload.videoId, {
      $set: { subtitleStatus: SubtitleStatus.FAILED },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  Highlight Request Dispatch
  // ─────────────────────────────────────────────────────────

  private async dispatchHighlightRequest(
    completeEvent: VideoCompleteEvent,
  ): Promise<void> {
    const highlightEnabled = this.configService.get<string>(
      'HIGHLIGHT_ENABLED',
      'true',
    );

    if (highlightEnabled !== 'true') {
      this.logger.log(
        `Highlights disabled — skipping for ${completeEvent.videoId}`,
      );
      return;
    }

    try {
      const video = await this.videoModel.findById(completeEvent.videoId);
      if (!video) {
        this.logger.warn(
          `Cannot dispatch highlight: video ${completeEvent.videoId} not found`,
        );
        return;
      }

      const highlightRequest: VideoHighlightRequestEvent = {
        videoId: completeEvent.videoId,
        proxy480pPath: completeEvent.hlsManifest || '',
        sourceVideoPath: video.videoUrl || '',
        videoTitle: video.title || 'Unknown Stream',
        videoDescription: video.description || 'No description provided',
        chatPath: null,
        configPath: this.configService.get<string>(
          'HIGHLIGHT_DEFAULT_CONFIG_PATH',
          'config/highlight_config.yaml',
        ),
        videoCategory: video.category,
        ownerId: video.userId.toString(),
        ts: Date.now(),
      };

      this.kafkaClient.emit(
        PIPELINE_TOPICS.VIDEO_HIGHLIGHTS_REQUEST,
        highlightRequest,
      );

      await this.videoModel.findByIdAndUpdate(completeEvent.videoId, {
        $set: { highlightStatus: HighlightStatus.QUEUED },
      });

      this.logger.log(
        `Dispatched highlight request for ${completeEvent.videoId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch highlight request for ${completeEvent.videoId}`,
        error,
      );
    }
  }
}
