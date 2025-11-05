import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentQueryDto,
  CommentsListResponseDto,
  CommentResponseDto,
} from './dto/comment.dto';
import type { AuthRequest, OptionalAuthRequest } from '../common/types';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: 'Get comments for a video' })
  @ApiResponse({
    status: 200,
    description: 'List of comments',
    type: CommentsListResponseDto,
  })
  @Get('video/:videoId')
  async getVideoComments(
    @Param('videoId') videoId: string,
    @Query() query: CommentQueryDto,
    @Req() req: OptionalAuthRequest,
  ): Promise<CommentsListResponseDto> {
    const userId = req.user?._id?.toString();
    return this.commentsService.getVideoComments(videoId, query, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a video' })
  @ApiResponse({
    status: 201,
    description: 'Comment created',
    type: CommentResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('video/:videoId')
  async addComment(
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.addComment(
      videoId,
      req.user._id.toString(),
      dto,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a comment' })
  @ApiResponse({
    status: 200,
    description: 'Comment updated',
    type: CommentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async editComment(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.editComment(id, req.user._id.toString(), dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.commentsService.deleteComment(id, req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a comment' })
  @ApiResponse({ status: 204, description: 'Comment liked' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async likeComment(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.commentsService.likeComment(id, req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove like from comment' })
  @ApiResponse({ status: 204, description: 'Like removed' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlikeComment(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.commentsService.unlikeComment(id, req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get replies to a comment' })
  @ApiResponse({
    status: 200,
    description: 'List of replies',
    type: CommentsListResponseDto,
  })
  @Get(':id/replies')
  async getReplies(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: OptionalAuthRequest,
  ): Promise<CommentsListResponseDto> {
    const userId = req?.user?._id?.toString();
    return this.commentsService.getReplies(id, page || 1, limit || 10, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a comment' })
  @ApiResponse({
    status: 201,
    description: 'Reply created',
    type: CommentResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/reply')
  async replyToComment(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.replyToComment(
      id,
      req.user._id.toString(),
      dto,
    );
  }
}
