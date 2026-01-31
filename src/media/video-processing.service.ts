import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from './schemas/vod.schema';
import * as path from 'path';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    @Inject('WORKER_SERVICE') private readonly workerClient: ClientKafka,
    @InjectModel(Vod.name) private readonly vodModel: Model<VodDocument>,
  ) {}

  async onModuleInit() {
    this.workerClient.subscribeToResponseOf('video.transcode');
    await this.workerClient.connect();
  }

  processAndSaveVideo(streamKey: string, filename: string) {
    this.logger.log(`Offloading VOD processing for ${streamKey} to worker`);

    const payload = {
      streamKey,
      filename: path.basename(filename),
    };

    this.workerClient.emit('video.transcode', payload);
  }

  async handleProcessedVideo(payload: {
    streamKey: string;
    filename: string;
    thumbnail: string;
    duration: number;
  }) {
    this.logger.log(
      `Handling processed video for ${payload.streamKey} and ${payload.filename}`,
    );

    await this.vodModel.create({
      filename: payload.filename,
      path: `/vods/${payload.filename}`,
      thumbnail: payload.thumbnail,
      duration: payload.duration,
      createdAt: new Date(),
    });

    this.logger.log(`VOD record created for ${payload.filename}`);
  }
}
