import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Video, VideoSchema } from './schemas/video.schema';
import { VodUploadController } from './upload/vod-upload.controller';
import { TusSessionService } from './upload/tus-session.service';
import { TusMiddleware } from './upload/tus.middleware';
import { VodEventsConsumer } from './pipeline/vod-events.consumer';
import { VodSocketGateway } from './pipeline/vod-socket.gateway';
import { ChannelsModule } from '../channels/channels.module';

/**
 * VodPipelineModule
 *
 * Houses upload pipeline components:
 * - TUS upload middleware & session management
 * - VOD event consumers & WebSocket gateway
 * - Kafka producer for dispatching transcode jobs
 */
@Module({
  imports: [
    ConfigModule,
    ChannelsModule,
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
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
  controllers: [VodUploadController, VodEventsConsumer],
  providers: [TusSessionService, TusMiddleware, VodSocketGateway],
  exports: [TusSessionService, VodSocketGateway],
})
export class VodPipelineModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TusMiddleware).forRoutes('vod-upload/tus');
  }
}
