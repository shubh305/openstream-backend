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

import { HttpModule } from '@nestjs/axios';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyAnalytics.name, schema: DailyAnalyticsSchema },
    ]),
    HttpModule,
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'ANALYTICS_SERVICE',
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
                sasl:
                  saslUser && saslPass
                    ? {
                        mechanism: 'plain' as const,
                        username: saslUser,
                        password: saslPass,
                      }
                    : undefined,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
    forwardRef(() => ChannelsModule),
    forwardRef(() => VideosModule),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
