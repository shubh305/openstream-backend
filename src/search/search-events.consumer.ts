import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Video, VideoDocument } from '../videos/schemas/video.schema';

interface IngestKeyMoment {
  time: string | number;
  description: string;
}

interface IngestResultPayload {
  entity_id: string;
  summary?: string;
  entities?: string[];
  key_moments?: IngestKeyMoment[];
  topic?: string;
}

@Controller()
export class SearchEventsConsumer {
  private readonly logger = new Logger(SearchEventsConsumer.name);
  static readonly INGEST_RESULTS_TOPIC =
    process.env.KAFKA_TOPIC_INGEST_RESULTS || 'openstream.ingest.results';

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
  ) {}

  @EventPattern(SearchEventsConsumer.INGEST_RESULTS_TOPIC)
  async handleIngestionResult(
    @Payload() message: { value: IngestResultPayload } | IngestResultPayload,
  ) {
    const payload = 'value' in message ? message.value : message;
    const { entity_id, summary, entities, key_moments, topic } = payload;
    console.log(
      `Received ingestion result for video: ${summary}, ${JSON.stringify(payload)}`,
    );
    if (!entity_id) {
      this.logger.error('Received ingestion result without entity_id');
      return;
    }

    this.logger.log(`Received ingestion result for video: ${entity_id}`);

    try {
      const aiMetadata = {
        summary: summary || null,
        entities: entities || [],
        topic: topic || null,
        keyMoments: (key_moments || []).map((km) => ({
          time:
            typeof km.time === 'string'
              ? this.parseTimestamp(km.time)
              : km.time,
          description: km.description,
        })),
      };

      await this.videoModel.findByIdAndUpdate(entity_id, {
        $set: { aiMetadata } as UpdateQuery<VideoDocument>,
      });

      this.logger.log(`Updated AI metadata for video: ${entity_id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update AI metadata for video ${entity_id}: ${errorMessage}`,
      );
    }
  }

  private parseTimestamp(ts: string): number {
    const parts = ts.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
}
