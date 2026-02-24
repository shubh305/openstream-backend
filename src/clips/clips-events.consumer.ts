import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { Clip, ClipDocument, ClipStatus } from './schemas/clip.schema';
import { ClipReadyEvent, ClipFailedEvent } from './events/clip-events.types';
import { VodSocketGateway } from '../videos/pipeline/vod-socket.gateway';
import { CLIP_TOPICS } from './events/clip-events.types';

@Controller()
export class ClipsEventsConsumer {
  private readonly logger = new Logger(ClipsEventsConsumer.name);

  constructor(
    @InjectModel(Clip.name) private readonly clipModel: Model<ClipDocument>,
    private readonly socketGateway: VodSocketGateway,
    @Inject('VOD_WORKER_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  @EventPattern(CLIP_TOPICS.READY)
  async handleClipReady(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as ClipReadyEvent;
    if (!payload.clipId) return;

    this.logger.log(`Clip READY: ${payload.clipId}`);

    const clip = await this.clipModel.findOneAndUpdate(
      { clipId: payload.clipId },
      {
        $set: {
          status: ClipStatus.READY,
          hlsManifest: payload.hlsManifest,
          readyAt: new Date(),
        },
      },
      { new: true },
    );

    if (clip && clip.parentVideoId) {
      this.socketGateway.notifyClipReady(
        clip.parentVideoId.toString(),
        clip.clipId,
      );

      // Emit analytics to `octane.events`
      this.kafkaClient.emit('octane.events', {
        app_id: 'openstream',
        event_name: 'clip.ready',
        user_id: clip.ownerId.toString(),
        timestamp: new Date().toISOString(),
        properties: {
          clipId: clip.clipId,
          parentVideoId: clip.parentVideoId.toString(),
        },
      });
    }
  }

  @EventPattern(CLIP_TOPICS.FAILED)
  async handleClipFailed(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as ClipFailedEvent;
    if (!payload.clipId) return;

    this.logger.warn(`Clip FAILED: ${payload.clipId} - ${payload.reason}`);

    await this.clipModel.findOneAndUpdate(
      { clipId: payload.clipId },
      { $set: { status: ClipStatus.FAILED } },
    );
  }
}
