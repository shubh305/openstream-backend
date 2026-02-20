import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @ApiOperation({ summary: 'Search videos and channels' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  @Get()
  async search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.searchService.search(query, limit || 20);
  }

  @ApiOperation({ summary: 'AI-Powered Semantic Search' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'AI Search results' })
  @Get('ai')
  async aiSearch(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.searchService.searchAI(query, limit || 20);
  }

  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial query' })
  @ApiResponse({ status: 200, description: 'Search suggestions' })
  @Get('suggestions')
  async getSuggestions(@Query('q') query: string) {
    return this.searchService.getSuggestions(query);
  }
}
