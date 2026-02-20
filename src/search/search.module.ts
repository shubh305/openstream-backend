import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { SemanticSearchService } from './semantic-search.service';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { VideosModule } from '../videos/videos.module';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';
import { StreamsModule } from '../streams/streams.module';

import { Video, VideoSchema } from '../videos/schemas/video.schema';
import { SearchEventsConsumer } from './search-events.consumer';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => VideosModule),
    forwardRef(() => ChannelsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => StreamsModule),
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
  ],
  controllers: [SearchController, SearchEventsConsumer],
  providers: [SearchService, SemanticSearchService],
  exports: [SearchService, SemanticSearchService],
})
export class SearchModule {}
