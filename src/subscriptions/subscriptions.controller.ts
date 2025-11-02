import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import {
  ToggleNotificationsDto,
  SubscriptionsListResponseDto,
  SubscriptionFeedResponseDto,
  SubscribersListResponseDto,
} from './dto/subscription.dto';
import type { AuthRequest } from '../common/types';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'List of subscriptions',
    type: SubscriptionsListResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getSubscriptions(
    @Req() req: AuthRequest,
  ): Promise<SubscriptionsListResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.getSubscriptions(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription feed' })
  @ApiResponse({
    status: 200,
    description: 'Videos from subscribed channels',
    type: SubscriptionFeedResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('feed')
  async getSubscriptionFeed(
    @Req() req: AuthRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<SubscriptionFeedResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.getSubscriptionFeed(
      userId,
      page || 1,
      limit || 20,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get channel subscribers (for channel owner)' })
  @ApiResponse({
    status: 200,
    description: 'List of subscribers',
    type: SubscribersListResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('subscribers')
  async getSubscribers(
    @Req() req: AuthRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<SubscribersListResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.getSubscribers(
      userId,
      page || 1,
      limit || 20,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to a channel' })
  @ApiResponse({ status: 201, description: 'Subscribed successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  @ApiResponse({ status: 409, description: 'Already subscribed' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':channelId')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Param('channelId') channelId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.subscribe(userId, channelId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unsubscribe from a channel' })
  @ApiResponse({ status: 204, description: 'Unsubscribed successfully' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @Param('channelId') channelId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.unsubscribe(userId, channelId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle notifications for a subscription' })
  @ApiResponse({ status: 204, description: 'Notifications toggled' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':channelId/notifications')
  @HttpCode(HttpStatus.NO_CONTENT)
  async toggleNotifications(
    @Param('channelId') channelId: string,
    @Req() req: AuthRequest,
    @Body() dto: ToggleNotificationsDto,
  ): Promise<void> {
    const userId = req.user.userId || req.user._id.toString();
    return this.subscriptionsService.toggleNotifications(
      userId,
      channelId,
      dto.enabled,
    );
  }
}
