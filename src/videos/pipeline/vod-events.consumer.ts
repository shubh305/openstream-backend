import { Controller, Logger } from '@nestjs/common';
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Types, Model, UpdateQuery } from 'mongoose';
import { Video, VideoDocument, VideoStatus } from '../schemas/video.schema';
import type {
  VideoPlayableEvent,
  VideoCompleteEvent,
} from '../events/pipeline-events';
import { VodSocketGateway } from './vod-socket.gateway';

@Controller()
export class VodEventsConsumer {
  private readonly logger = new Logger(VodEventsConsumer.name);

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    private readonly socketGateway: VodSocketGateway,
  ) {
    this.logger.log(
      'VodEventsConsumer initialized and listening for Kafka events',
    );
  }

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

  /**
   * Kafka consumer for `video.complete` events.
   * Fired by FFmpeg Worker slow lane when all resolutions are done.
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
  }
}
