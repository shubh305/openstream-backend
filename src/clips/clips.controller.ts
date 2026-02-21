import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ClipsService, PaginatedClips, ResolvedClip } from './clips.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ClipsController {
  constructor(private readonly clipsService: ClipsService) {}

  @Get('clips')
  async getClipsfeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('signal') signal?: string,
  ): Promise<PaginatedClips> {
    return this.clipsService.getClips({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      signal,
    });
  }

  @Get('vod/:id/clips')
  async getVideoClips(@Param('id') videoId: string): Promise<ResolvedClip[]> {
    return this.clipsService.getClipsForVideo(videoId);
  }

  @Get('clips/:clipId')
  async getClipDetails(@Param('clipId') clipId: string): Promise<ResolvedClip> {
    return this.clipsService.getClipById(clipId);
  }

  @Post('clips/:clipId/view')
  async incrementClipView(
    @Param('clipId') clipId: string,
  ): Promise<{ viewCount: number }> {
    return this.clipsService.incrementViewCount(clipId);
  }
}
