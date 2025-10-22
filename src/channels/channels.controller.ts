import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import {
  UpdateChannelDto,
  ChannelResponseDto,
  ChannelStatsDto,
} from './dto/channel.dto';
import { PlaylistsService } from '../playlists/playlists.service';
import type { AuthRequest, OptionalAuthRequest } from '../common/types';

interface UploadedBrandingFiles {
  banner?: Express.Multer.File[];
  picture?: Express.Multer.File[];
}

@ApiTags('Channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly playlistsService: PlaylistsService,
  ) {}

  @ApiOperation({ summary: 'Get channel playlists' })
  @Get(':id/playlists')
  async getChannelPlaylists(@Param('id') id: string) {
    return this.playlistsService.getChannelPlaylists(id);
  }

  @ApiOperation({ summary: 'Create a channel (if not exists)' })
  @ApiResponse({
    status: 201,
    description: 'Channel created',
    type: ChannelResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Channel already exists' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createChannel(@Req() req: AuthRequest): Promise<ChannelResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.channelsService.getMyChannel(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my channel' })
  @ApiResponse({
    status: 200,
    description: 'Your channel details',
    type: ChannelResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyChannel(@Req() req: AuthRequest): Promise<ChannelResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.channelsService.getMyChannel(userId);
  }

  @ApiOperation({ summary: 'Get channel by handle' })
  @ApiResponse({
    status: 200,
    description: 'Channel details',
    type: ChannelResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  @Get(':handle')
  async getChannelByHandle(
    @Param('handle') handle: string,
    @Req() req: OptionalAuthRequest,
  ): Promise<ChannelResponseDto> {
    const userId = req.user?.userId || req.user?._id?.toString();
    return this.channelsService.getChannelByHandle(handle, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my channel' })
  @ApiResponse({
    status: 200,
    description: 'Updated channel details',
    type: ChannelResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  @ApiResponse({ status: 409, description: 'Handle already taken' })
  @UseGuards(AuthGuard('jwt'))
  @Put('me')
  async updateChannel(
    @Req() req: AuthRequest,
    @Body() updateDto: UpdateChannelDto,
  ): Promise<ChannelResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    return this.channelsService.updateChannel(userId, updateDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update channel branding (banner and picture)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Banner image (max 6MB, 2048x1152 recommended)',
        },
        picture: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture (max 2MB, 98x98 minimum)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated channel with new branding',
    type: ChannelResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'banner', maxCount: 1 },
      { name: 'picture', maxCount: 1 },
    ]),
  )
  @Put('me/branding')
  async updateBranding(
    @Req() req: AuthRequest,
    @UploadedFiles() files: UploadedBrandingFiles,
  ): Promise<ChannelResponseDto> {
    const userId = req.user.userId || req.user._id.toString();
    const bannerUrl = files.banner?.[0]
      ? `/uploads/banners/${files.banner[0].filename}`
      : undefined;
    const pictureUrl = files.picture?.[0]
      ? `/uploads/avatars/${files.picture[0].filename}`
      : undefined;

    return this.channelsService.updateBranding(userId, bannerUrl, pictureUrl);
  }

  @ApiOperation({ summary: 'Get channel statistics' })
  @ApiResponse({
    status: 200,
    description: 'Channel statistics',
    type: ChannelStatsDto,
  })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  @Get(':handle/stats')
  async getChannelStats(
    @Param('handle') handle: string,
  ): Promise<ChannelStatsDto> {
    return this.channelsService.getChannelStats(handle);
  }
}
