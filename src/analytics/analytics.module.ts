import { Module, forwardRef } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ChannelsModule } from '../channels/channels.module';
import { VideosModule } from '../videos/videos.module';

import { MongooseModule } from '@nestjs/mongoose';
import {
  DailyAnalytics,
  DailyAnalyticsSchema,
} from './schemas/daily-analytics.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyAnalytics.name, schema: DailyAnalyticsSchema },
    ]),
    forwardRef(() => ChannelsModule),
    forwardRef(() => VideosModule),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
