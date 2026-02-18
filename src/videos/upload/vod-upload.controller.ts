import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { TusSessionService } from './tus-session.service';
import { ChannelsService } from '../../channels/channels.service';
import {
  ValidateUploadDto,
  ValidateUploadResponseDto,
} from '../dto/validate-upload.dto';

/** Allowed MIME types for video uploads */
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/x-matroska',
  'video/avi',
  'video/quicktime',
  'video/x-msvideo',
];

interface JwtPayload {
  sub: string;
  channelId?: string;
}

@ApiTags('VOD Upload')
@Controller('vod-upload')
export class VodUploadController {
  constructor(
    private readonly sessionService: TusSessionService,
    private readonly channelsService: ChannelsService,
  ) {}

  /**
   * Server-side upload validation.
   * Validates file metadata (size, type) and creates a TUS session.
   */
  @Post('validate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate file and create TUS upload session' })
  async validateUpload(
    @Body() dto: ValidateUploadDto,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<ValidateUploadResponseDto> {
    const maxBytes = this.sessionService.getMaxUploadBytes();

    if (dto.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `File size ${dto.sizeBytes} exceeds maximum allowed ${maxBytes} bytes`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${dto.mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const userId = req.user.sub;
    let channelId = req.user.channelId;

    if (!channelId) {
      try {
        const channel = await this.channelsService.getMyChannel(userId);
        if (channel) {
          channelId = channel.id;
        }
      } catch (e) {
        console.error('Failed to find or create channel for upload', e);
        channelId = userId;
      }
    }
    const finalChannelId = channelId || userId;

    // Create TUS session
    const session = await this.sessionService.createSession(
      userId,
      finalChannelId,
      dto.fileName,
      dto.sizeBytes,
      dto.mimeType,
    );

    return {
      sessionId: session.sessionId,
      videoId: session.videoId,
      uploadUrl: `/api/vod-upload/tus/${session.sessionId}`,
    };
  }

  /**
   * Get the status of an upload session.
   */
  @Get('session/:sessionId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get upload session status' })
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return {
      sessionId: session.sessionId,
      videoId: session.videoId,
      fileName: session.fileName,
      sizeBytes: session.sizeBytes,
      createdAt: session.createdAt,
    };
  }
}
