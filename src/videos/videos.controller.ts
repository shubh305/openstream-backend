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
  ApiQuery,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoQueryDto,
  VideoListResponseDto,
  VideoListItemDto,
  VideoDetailDto,
} from './dto/video.dto';
import type { AuthRequest, OptionalAuthRequest } from '../common/types';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @ApiOperation({ summary: 'List videos with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of videos',
    type: VideoListResponseDto,
  })
  @Get()
  async listVideos(
    @Query() query: VideoQueryDto,
    @Req() req: OptionalAuthRequest,
  ): Promise<VideoListResponseDto> {
    const userId = req.user?._id?.toString();
    return this.videosService.listVideos(query, userId);
  }

  @ApiOperation({ summary: 'Get trending videos' })
  @ApiResponse({
    status: 200,
    description: 'List of trending videos',
    type: [VideoListItemDto],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('trending')
  async getTrendingVideos(
    @Query('limit') limit?: number,
  ): Promise<VideoListItemDto[]> {
    return this.videosService.getTrendingVideos(limit || 12);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized video feed' })
  @ApiResponse({
    status: 200,
    description: 'Personalized video feed',
    type: VideoListResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('feed')
  async getFeed(
    @Req() req: AuthRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<VideoListResponseDto> {
    return this.videosService.getFeed(
      req.user._id.toString(),
      page || 1,
      limit || 12,
    );
  }

  @ApiOperation({ summary: 'Get video by ID' })
  @ApiResponse({
    status: 200,
    description: 'Video details',
    type: VideoDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @Get(':id')
  async getVideoById(
    @Param('id') id: string,
    @Req() req: OptionalAuthRequest,
  ): Promise<VideoDetailDto> {
    const userId = req.user?._id?.toString();
    return this.videosService.getVideoById(id, userId);
  }

  @ApiOperation({ summary: 'Get video recommendations' })
  @ApiResponse({
    status: 200,
    description: 'List of recommended videos',
    type: [VideoListItemDto],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get(':id/recommendations')
  async getRecommendations(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ): Promise<VideoListItemDto[]> {
    return this.videosService.getRecommendations(id, limit || 10);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new video' })
  @ApiResponse({
    status: 201,
    description: 'Video created',
    type: VideoDetailDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createVideo(
    @Req() req: AuthRequest,
    @Body() createDto: CreateVideoDto,
  ): Promise<VideoDetailDto> {
    return this.videosService.createVideo(req.user._id.toString(), createDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update video metadata' })
  @ApiResponse({
    status: 200,
    description: 'Video updated',
    type: VideoDetailDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() updateDto: UpdateVideoDto,
  ): Promise<VideoDetailDto> {
    return this.videosService.updateVideo(
      id,
      req.user._id.toString(),
      updateDto,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a video' })
  @ApiResponse({ status: 204, description: 'Video deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.videosService.deleteVideo(id, req.user._id.toString());
  }

  @ApiOperation({ summary: 'Increment video view count' })
  @ApiResponse({ status: 204, description: 'View recorded' })
  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async incrementView(@Param('id') id: string): Promise<void> {
    return this.videosService.incrementView(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like a video' })
  @ApiResponse({ status: 204, description: 'Video liked' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async likeVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.videosService.likeVideo(id, req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove like from video' })
  @ApiResponse({ status: 204, description: 'Like removed' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlikeVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.videosService.unlikeVideo(id, req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dislike a video' })
  @ApiResponse({ status: 204, description: 'Video disliked' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/dislike')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dislikeVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.videosService.dislikeVideo(id, req.user._id.toString());
  }
}
