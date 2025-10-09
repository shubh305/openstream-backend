import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from '../media/schemas/vod.schema';

@ApiTags('Streams')
@Controller('streams')
export class StreamsController {
  constructor(
    private readonly authService: AuthService,
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
    // Fetch from DB sorted by newest
    const vods = await this.vodModel.find().sort({ createdAt: -1 }).exec();
    return vods.map((vod) => ({
      filename: vod.filename,
      url: vod.path,
      thumbnail: vod.thumbnail,
      createdAt: vod.createdAt,
    }));
  }
}
