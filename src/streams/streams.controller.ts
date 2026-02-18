import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';

import { StreamsService } from './streams.service';
import { AuthService } from '../auth/auth.service';
import { VideoProcessingService } from '../media/video-processing.service';
import { Vod, VodDocument } from '../media/schemas/vod.schema';
import {
  AuthWebhookDto,
  ProcessWebhookDto,
  UpdateStreamSettingsDto,
  StreamResponseDto,
  StreamKeyResponseDto,
  StreamListResponseDto,
} from './dto/webhook.dto';
import type { AuthRequest } from '../common/types';

@ApiTags('Streams')
@Controller('streams')
export class StreamsController {
  constructor(
    private readonly streamsService: StreamsService,
    private readonly authService: AuthService,
    private readonly videoProcessingService: VideoProcessingService,
    private readonly configService: ConfigService,
    @InjectModel(Vod.name) private vodModel: Model<VodDocument>,
  ) {}

  @ApiOperation({ summary: 'List all active (live) streams' })
  @ApiResponse({
    status: 200,
    description: 'List of live streams',
    type: StreamListResponseDto,
  })
  @Get()
  async getLiveStreams(): Promise<StreamListResponseDto> {
    return this.streamsService.getLiveStreams();
  }

  @ApiOperation({ summary: 'Get Ingest Configuration (WebSocket)' })
  @ApiResponse({
    status: 200,
    description: 'Returns WebSocket connection details for streaming.',
  })
  @Get('ingest')
  getIngestConfig(@Req() request: Request) {
    const host = request.headers['host'];
    const xForwardedProto = request.headers['x-forwarded-proto'];

    const isSecure =
      (typeof xForwardedProto === 'string' && xForwardedProto === 'https') ||
      request.protocol === 'https';

    const protocol = isSecure ? 'wss' : 'ws';

    return {
      url: `${protocol}://${host}/ingest?key={streamKey}`,
      protocol: 'flv',
      description: 'Connect via WebSocket with your Stream Key.',
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user stream key and RTMP info' })
  @ApiResponse({
    status: 200,
    description: 'Stream key and connection URLs',
    type: StreamKeyResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('key')
  async getStreamKey(@Req() req: AuthRequest): Promise<StreamKeyResponseDto> {
    return this.streamsService.getStreamKey(req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user stream' })
  @ApiResponse({
    status: 200,
    description: 'Current user stream details',
    type: StreamResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyStream(@Req() req: AuthRequest): Promise<StreamResponseDto> {
    return this.streamsService.getMyStream(req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate stream key' })
  @ApiResponse({
    status: 201,
    description: 'New stream key generated',
    type: StreamKeyResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('key/regenerate')
  async regenerateStreamKey(
    @Req() req: AuthRequest,
  ): Promise<StreamKeyResponseDto> {
    return this.streamsService.regenerateStreamKey(req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update stream settings' })
  @ApiResponse({
    status: 200,
    description: 'Updated stream settings',
    type: StreamResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Put('settings')
  async updateSettings(
    @Req() req: AuthRequest,
    @Body() settings: UpdateStreamSettingsDto,
  ): Promise<StreamResponseDto> {
    return this.streamsService.updateSettings(
      req.user._id.toString(),
      settings,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a live stream session' })
  @ApiResponse({
    status: 201,
    description: 'Stream started',
    type: StreamResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Already have an active stream' })
  @UseGuards(AuthGuard('jwt'))
  @Post('go-live')
  async goLive(@Req() req: AuthRequest): Promise<StreamResponseDto> {
    return this.streamsService.goLive(req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'End current stream' })
  @ApiResponse({
    status: 200,
    description: 'Stream ended',
    type: StreamResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No active stream' })
  @UseGuards(AuthGuard('jwt'))
  @Post('end')
  @HttpCode(HttpStatus.OK)
  async endStream(@Req() req: AuthRequest): Promise<StreamResponseDto> {
    return this.streamsService.endStream(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get stream by ID' })
  @ApiResponse({
    status: 200,
    description: 'Stream details',
    type: StreamResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Stream not found' })
  @Get(':id')
  async getStreamById(@Param('id') id: string): Promise<StreamResponseDto> {
    return this.streamsService.getStreamById(id);
  }

  @ApiOperation({ summary: 'List archived VODs' })
  @ApiResponse({
    status: 200,
    description: 'List of recorded streams',
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
    const result = await this.validateRequest(body);
    await this.streamsService.onPublishStart(body.name);
    return result;
  }

  @Post('on_publish_done')
  async onPublishDone(@Body() body: AuthWebhookDto) {
    await this.streamsService.onPublishEnd(body.name);
    return { status: 'ok' };
  }

  private async validateRequest(body: AuthWebhookDto) {
    const streamKey = body.name.replace('sk_live_', '');
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
    const volPath =
      this.configService.get<string>('OPENSTREAM_VOL_PATH') ||
      '/usr/src/app/media/recordings';
    const containerPath = path.join(volPath, filename);
    const streamKey = filename.split('-')[0].split('.')[0];

    void this.videoProcessingService.processAndSaveVideo(
      streamKey,
      containerPath,
    );

    void this.streamsService.onPublishEnd(streamKey);

    return { status: 'processing_started', bridge_path: containerPath };
  }
}
