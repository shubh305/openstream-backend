import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
import { PlaylistsService } from './playlists.service';
import {
  CreatePlaylistDto,
  UpdatePlaylistDto,
  ReorderVideosDto,
  AddVideoDto,
} from './dto/playlist.dto';
import type { AuthRequest, OptionalAuthRequest } from '../common/types';

@ApiTags('Playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user playlists' })
  @ApiResponse({ status: 200, description: 'List of playlists' })
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getUserPlaylists(@Req() req: AuthRequest) {
    return this.playlistsService.getUserPlaylists(req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get watch later playlist' })
  @ApiResponse({ status: 200, description: 'Watch later playlist' })
  @UseGuards(AuthGuard('jwt'))
  @Get('watch-later')
  async getWatchLater(@Req() req: AuthRequest) {
    return this.playlistsService.getWatchLater(req.user._id.toString());
  }

  @ApiOperation({ summary: 'Get playlist by ID' })
  @ApiResponse({ status: 200, description: 'Playlist with videos' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  @Get(':id')
  async getPlaylistById(
    @Param('id') id: string,
    @Req() req: OptionalAuthRequest,
  ) {
    const userId = req.user?._id?.toString();
    return this.playlistsService.getPlaylistById(id, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create playlist' })
  @ApiResponse({ status: 201, description: 'Playlist created' })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createPlaylist(
    @Req() req: AuthRequest,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistsService.createPlaylist(
      req.user._id.toString(),
      dto.title,
      dto.description,
      dto.visibility,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update playlist' })
  @ApiResponse({ status: 200, description: 'Playlist updated' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updatePlaylist(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.updatePlaylist(
      id,
      req.user._id.toString(),
      dto,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete playlist' })
  @ApiResponse({ status: 204, description: 'Playlist deleted' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlaylist(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.playlistsService.deletePlaylist(id, req.user._id.toString());
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add video to playlist' })
  @ApiResponse({ status: 201, description: 'Video added' })
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/videos')
  @HttpCode(HttpStatus.CREATED)
  async addVideo(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() body: AddVideoDto,
  ): Promise<void> {
    return this.playlistsService.addVideo(
      id,
      body.videoId,
      req.user._id.toString(),
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove video from playlist' })
  @ApiResponse({ status: 204, description: 'Video removed' })
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/videos/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVideo(
    @Param('id') id: string,
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.playlistsService.removeVideo(
      id,
      videoId,
      req.user._id.toString(),
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder videos in playlist' })
  @ApiResponse({ status: 204, description: 'Videos reordered' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':id/videos/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderVideos(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: ReorderVideosDto,
  ): Promise<void> {
    return this.playlistsService.reorderVideos(
      id,
      dto.videoOrder,
      req.user._id.toString(),
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add video to watch later' })
  @ApiResponse({ status: 201, description: 'Added to watch later' })
  @UseGuards(AuthGuard('jwt'))
  @Post('watch-later/:videoId')
  @HttpCode(HttpStatus.CREATED)
  async addToWatchLater(
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.playlistsService.addToWatchLater(
      videoId,
      req.user._id.toString(),
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove video from watch later' })
  @ApiResponse({ status: 204, description: 'Removed from watch later' })
  @UseGuards(AuthGuard('jwt'))
  @Delete('watch-later/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromWatchLater(
    @Param('videoId') videoId: string,
    @Req() req: AuthRequest,
  ): Promise<void> {
    return this.playlistsService.removeFromWatchLater(
      videoId,
      req.user._id.toString(),
    );
  }
}
