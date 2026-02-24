import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Post,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import type { AuthRequest, OptionalAuthRequest } from '../common/types';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'Get channel analytics' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiResponse({ status: 200, description: 'Realtime stats' })
  @Get('channel/realtime')
  async getRealtimeStats(@Req() req: AuthRequest) {
    return this.analyticsService.getRealtimeAnalytics(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get video analytics' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
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

  @ApiOperation({ summary: 'Get engagement and search analytics' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['last28days', 'last7days', 'today'],
  })
  @ApiResponse({ status: 200, description: 'Engagement analytics' })
  @Get('engagement')
  async getEngagementAnalytics(
    @Req() req: AuthRequest,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getEngagementAnalytics(
      req.user._id.toString(),
      period || 'last28days',
    );
  }

  @ApiOperation({ summary: 'Track a client-side event' })
  @ApiResponse({ status: 202, description: 'Event accepted' })
  @Post('track')
  trackEvent(
    @Body() payload: { event: string; properties?: Record<string, unknown> },
    @Req() req: OptionalAuthRequest,
  ) {
    const userId = req.user?._id?.toString() || 'anonymous';
    const userAgent = req.headers['user-agent'] || 'unknown';

    void this.analyticsService.trackGenericEvent(
      payload.event,
      {
        ...payload.properties,
        user_agent: userAgent,
      },
      userId,
    );

    return { status: 'accepted' };
  }
}
