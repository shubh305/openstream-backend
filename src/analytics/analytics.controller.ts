import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import type { AuthRequest } from '../common/types';

@ApiTags('Analytics')
@Controller('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'Get channel analytics' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['lifetime', 'last28days', 'last7days', 'today'],
  })
  @ApiResponse({ status: 200, description: 'Channel analytics' })
  @Get('channel')
  async getChannelAnalytics(
    @Req() req: AuthRequest,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getChannelAnalytics(
      req.user._id.toString(),
      period || 'last28days',
    );
  }

  @ApiOperation({ summary: 'Get realtime analytics' })
  @ApiResponse({ status: 200, description: 'Realtime stats' })
  @Get('channel/realtime')
  async getRealtimeAnalytics(@Req() req: AuthRequest) {
    return this.analyticsService.getRealtimeAnalytics(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get video analytics' })
  @ApiResponse({ status: 200, description: 'Video analytics' })
  @Get('video/:id')
  async getVideoAnalytics(
    @Param('id') videoId: string,
    @Req() req: AuthRequest,
  ) {
    return this.analyticsService.getVideoAnalytics(
      videoId,
      req.user._id.toString(),
    );
  }

  @ApiOperation({ summary: 'Get top performing content' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['last28days', 'last7days'],
  })
  @ApiResponse({ status: 200, description: 'Top content' })
  @Get('top-content')
  async getTopContent(
    @Req() req: AuthRequest,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getTopContent(
      req.user._id.toString(),
      period || 'last28days',
    );
  }
}
