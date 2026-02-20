import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';
import { Video, VideoSchema } from './schemas/video.schema';
import { VodUploadController } from './upload/vod-upload.controller';
import { TusSessionService } from './upload/tus-session.service';
import { TusMiddleware } from './upload/tus.middleware';
import { VodEventsConsumer } from './pipeline/vod-events.consumer';
import { SubtitleConsumer } from './pipeline/subtitle.consumer';
import { VodSocketGateway } from './pipeline/vod-socket.gateway';
import { ClipsModule } from '../clips/clips.module';
import { ChannelsModule } from '../channels/channels.module';
import { ClipsEventsConsumer } from '../clips/clips-events.consumer';
import { StorageModule } from '../storage/storage.module';
import { SearchModule } from '../search/search.module';

/**
 * VodPipelineModule
 *
 * Houses upload pipeline components:
 * - TUS upload middleware & session management
 * - VOD event consumers & WebSocket gateway
 * - Kafka producer for dispatching transcode jobs
 * - Subtitle consumer
 */
@Module({
  imports: [
    ConfigModule,
    ChannelsModule,
    StorageModule,
    HttpModule.register({ timeout: 300000 }),
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    ClipsModule,
    SearchModule,
    ClientsModule.registerAsync([
      {
        name: 'VOD_WORKER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const saslUser = configService.get<string>('KAFKA_SASL_USER');
          const saslPass = configService.get<string>('KAFKA_SASL_PASS');
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: configService
                  .get<string>('KAFKA_BROKERS', 'broker.octanebrew.dev:8085')
                  .split(','),
                connectionTimeout: 10000,
                requestTimeout: 30000,
                sasl:
                  saslUser && saslPass
                    ? {
                        mechanism: 'plain' as const,
                        username: saslUser,
                        password: saslPass,
                      }
                    : undefined,
              },
              consumer: {
                groupId: configService.get<string>(
                  'KAFKA_VOD_GROUP_ID',
                  'vod-pipeline-producer',
                ),
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [
    VodUploadController,
    VodEventsConsumer,
    SubtitleConsumer,
    ClipsEventsConsumer,
  ],
  providers: [TusSessionService, TusMiddleware, VodSocketGateway],
  exports: [TusSessionService, VodSocketGateway],
})
export class VodPipelineModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TusMiddleware).forRoutes('vod-upload/tus');
  }
}
