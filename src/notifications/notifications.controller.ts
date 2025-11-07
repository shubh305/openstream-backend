import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
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
import { NotificationsService } from './notifications.service';
import type { AuthRequest } from '../common/types';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  @Get()
  async getNotifications(@Req() req: AuthRequest) {
    return this.notificationsService.getNotifications(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthRequest) {
    const count = await this.notificationsService.getUnreadCount(
      req.user._id.toString(),
    );
    return { unreadCount: count };
  }

  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 204, description: 'Marked as read' })
  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.notificationsService.markAsRead(id, req.user._id.toString());
  }

  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 204, description: 'All marked as read' })
  @Put('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@Req() req: AuthRequest): Promise<void> {
    return this.notificationsService.markAllAsRead(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Clear all notifications' })
  @ApiResponse({ status: 204, description: 'All notifications cleared' })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearAll(@Req() req: AuthRequest): Promise<void> {
    return this.notificationsService.clearAll(req.user._id.toString());
  }
}
