import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
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
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'Get chat history for a stream' })
  @ApiResponse({ status: 200, description: 'Chat messages' })
  @Get(':streamId/history')
  async getHistory(
    @Param('streamId') streamId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getHistory(streamId, limit || 50);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban user from chat (moderator only)' })
  @ApiResponse({ status: 204, description: 'User banned' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':streamId/ban')
  @HttpCode(HttpStatus.NO_CONTENT)
  async banUser(
    @Param('streamId') streamId: string,
    @Body() body: { userId: string },
  ): Promise<void> {
    return this.chatService.banUser(streamId, body.userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a chat message (moderator only)' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':streamId/message/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(@Param('id') messageId: string): Promise<void> {
    return this.chatService.deleteMessage(messageId);
  }
}
