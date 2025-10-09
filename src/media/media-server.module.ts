import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaServerService } from './media-server.service';
import { VideoProcessingService } from './video-processing.service';
import { AuthModule } from '../auth/auth.module';
import { Vod, VodSchema } from './schemas/vod.schema';
import { StreamsController } from '../streams/streams.controller';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Vod.name, schema: VodSchema }]),
  ],
  providers: [MediaServerService, VideoProcessingService],
  controllers: [StreamsController],
  exports: [MediaServerService],
})
export class MediaServerModule {}
