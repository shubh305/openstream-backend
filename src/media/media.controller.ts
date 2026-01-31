import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { VideoProcessingService } from './video-processing.service';

interface ProcessedPayload {
  streamKey: string;
  filename: string;
  thumbnail: string;
  duration: number;
}

@Controller()
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly videoService: VideoProcessingService) {}

  @EventPattern('video.processed')
  async handleVideoProcessed(@Payload() message: any) {
    this.logger.log(`Received processed VOD: ${JSON.stringify(message)}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const payload: ProcessedPayload = message.value ? message.value : message;

    await this.videoService.handleProcessedVideo(payload);
  }
}
