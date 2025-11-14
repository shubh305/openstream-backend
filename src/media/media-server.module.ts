import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoProcessingService } from './video-processing.service';
import { Vod, VodSchema } from './schemas/vod.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Vod.name, schema: VodSchema }])],
  providers: [VideoProcessingService],
  exports: [VideoProcessingService, MongooseModule],
})
export class MediaServerModule {}
