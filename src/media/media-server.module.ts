import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoProcessingService } from './video-processing.service';
import { Vod, VodSchema } from './schemas/vod.schema';

import { ConfigService, ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MediaController } from './media.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vod.name, schema: VodSchema }]),
    ClientsModule.registerAsync([
      {
        name: 'WORKER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:8084')],
              connectionTimeout: 10000,
              requestTimeout: 30000,
            },
            consumer: {
              groupId: 'api-producer',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [MediaController],
  providers: [VideoProcessingService],
  exports: [VideoProcessingService, MongooseModule],
})
export class MediaServerModule {}
