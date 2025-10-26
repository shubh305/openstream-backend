import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideosRepository } from './videos.repository';
import { Video, VideoSchema } from './schemas/video.schema';
import { VideoLike, VideoLikeSchema } from './schemas/video-like.schema';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: VideoLike.name, schema: VideoLikeSchema },
    ]),
    forwardRef(() => ChannelsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [VideosController],
  providers: [VideosService, VideosRepository],
  exports: [VideosService, VideosRepository],
})
export class VideosModule {}
