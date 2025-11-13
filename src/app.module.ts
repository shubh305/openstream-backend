import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MongooseModule } from '@nestjs/mongoose';

// Core modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaServerModule } from './media/media-server.module';
import { GatewayModule } from './gateway/gateway.module';

// Feature modules
import { ChannelsModule } from './channels/channels.module';
import { VideosModule } from './videos/videos.module';
import { StreamsModule } from './streams/streams.module';
import { CommentsModule } from './comments/comments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { UploadModule } from './upload/upload.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { AppController } from './app.controller';

import * as Joi from 'joi';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        RTMP_INGEST_URL: Joi.string().default('rtmp://localhost:1935/live'),
        PORT: Joi.number().default(4000),
        API_PREFIX: Joi.string().default('api'),
      }),
    }),

    // Static file serving
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'vod'),
      serveRoot: '/vods',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),

    // Core modules
    AuthModule,
    UsersModule,
    MediaServerModule,
    GatewayModule,

    // Feature modules
    ChannelsModule,
    VideosModule,
    StreamsModule,
    CommentsModule,
    SubscriptionsModule,
    PlaylistsModule,
    NotificationsModule,
    ChatModule,
    UploadModule,
    SearchModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
