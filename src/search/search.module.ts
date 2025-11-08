import { Module, forwardRef } from '@nestjs/common';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { VideosModule } from '../videos/videos.module';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    forwardRef(() => VideosModule),
    forwardRef(() => ChannelsModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
