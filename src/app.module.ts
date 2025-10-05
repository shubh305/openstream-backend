import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaServerModule } from './media/media-server.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuthModule } from './auth/auth.module';

import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        PORT: Joi.number().default(3000),
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'vod'),
      serveRoot: '/vods',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    MediaServerModule,
    GatewayModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
