import {
  Controller,
  Get,
  Post,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from '../media/schemas/vod.schema';
import * as path from 'path';
import { VideoProcessingService } from '../media/video-processing.service';
import { AuthWebhookDto, ProcessWebhookDto } from './dto/webhook.dto';

@ApiTags('Streams')
@Controller('streams')
export class StreamsController {
  constructor(
    private readonly authService: AuthService,
    private readonly videoProcessingService: VideoProcessingService,
    @InjectModel(Vod.name) private vodModel: Model<VodDocument>,
  ) {}

  @ApiOperation({ summary: 'Get Ingest Configuration (WebSocket)' })
  @ApiResponse({
    status: 200,
    description: 'Returns WebSocket connection details for streaming.',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'ws://localhost:3000/ingest?key=sk_12345',
        },
        protocol: { type: 'string', example: 'flv' },
        description: {
          type: 'string',
          example: 'Send binary FLV data over WebSocket',
        },
      },
    },
  })
  @Get('ingest')
  getIngestConfig() {
    return {
      url: 'ws://localhost:3000/ingest?key={streamKey}',
      protocol: 'flv',
      description: 'Connect via WebSocket with your Stream Key.',
    };
  }

  @ApiOperation({ summary: 'List archived VODs' })
  @ApiResponse({
    status: 200,
    description: 'List of recorded streams',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filename: { type: 'string' },
          url: { type: 'string' },
          thumbnail: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @Get('vods')
  async listVods() {
    const vods = await this.vodModel.find().sort({ createdAt: -1 }).exec();
    return vods.map((vod) => ({
      filename: vod.filename,
      url: vod.path,
      thumbnail: vod.thumbnail,
      createdAt: vod.createdAt,
    }));
  }
  @Post('auth')
  @ApiOperation({
    summary: 'Nginx-RTMP Auth Webhook',
    description: 'Validates stream key from Nginx-RTMP on_publish event',
  })
  @ApiResponse({ status: 200, description: 'Stream allowed' })
  @ApiResponse({ status: 403, description: 'Stream denied' })
  async onPublishLegacy(@Body() body: AuthWebhookDto) {
    return this.validateRequest(body);
  }

  @Post('on_publish')
  async onPublish(@Body() body: AuthWebhookDto) {
    return this.validateRequest(body);
  }

  private async validateRequest(body: AuthWebhookDto) {
    const streamKey = body.name;
    const isValid = await this.authService.validateStreamKey(streamKey);
    if (!isValid) {
      throw new ForbiddenException('Invalid stream key');
    }
    return { status: 'ok' };
  }

  @Post('on_record_done')
  onRecordDoneLegacy(@Body() body: ProcessWebhookDto) {
    return this.onRecordDone(body);
  }

  @Post('process')
  @ApiOperation({
    summary: 'Nginx-RTMP Recording Hook',
    description: 'Triggers processing when Nginx finishes recording',
  })
  @ApiResponse({ status: 200, description: 'Processing started' })
  onRecordDone(@Body() body: ProcessWebhookDto) {
    const hostPath = body.path;
    const filename = path.basename(hostPath);
    const containerPath = path.join('/usr/src/app/media/recordings', filename);

    const streamKey = filename.split('-')[0].split('.')[0];

    // Trigger processing asynchronously
    void this.videoProcessingService.processAndSaveVideo(
      streamKey,
      containerPath,
    );

    return { status: 'processing_started', bridge_path: containerPath };
  }
}
