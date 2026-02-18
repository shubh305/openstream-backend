import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoProcessingService } from './video-processing.service';
import { Vod, VodSchema } from './schemas/vod.schema';
import { VideosModule } from '../videos/videos.module';
import { UsersModule } from '../users/users.module';
import { StreamsModule } from '../streams/streams.module';
import { ChannelsModule } from '../channels/channels.module';

import { ConfigService, ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MediaController } from './media.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vod.name, schema: VodSchema }]),
    forwardRef(() => VideosModule),
    forwardRef(() => UsersModule),
    forwardRef(() => StreamsModule),
    forwardRef(() => ChannelsModule),
    ClientsModule.registerAsync([
      {
        name: 'WORKER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const saslUser = configService.get<string>('KAFKA_SASL_USER');
          const saslPass = configService.get<string>('KAFKA_SASL_PASS');
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: [
                  configService.get(
                    'KAFKA_BROKERS',
                    'broker.octanebrew.dev:8085',
                  ),
                ],
                connectionTimeout: 10000,
                requestTimeout: 30000,
                sasl:
                  saslUser && saslPass
                    ? {
                        mechanism: 'plain',
                        username: saslUser,
                        password: saslPass,
                      }
                    : undefined,
              },
              consumer: {
                groupId: 'api-producer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [MediaController],
  providers: [VideoProcessingService],
  exports: [VideoProcessingService, MongooseModule],
})
export class MediaServerModule {}
