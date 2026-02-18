import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import type { Request, Response, NextFunction } from 'express';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'debug', 'error', 'warn', 'verbose'],
  });
  const configService = app.get(ConfigService);
  const prefix = configService.get<string>('API_PREFIX') || 'api';

  app.setGlobalPrefix(prefix);
  app.enableCors();

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  if (process.env.NODE_ENV !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[Request] ${req.method} ${req.url}`);
      next();
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useWebSocketAdapter(new WsAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('OpenStream API')
    .setDescription('The OpenStream Backend API description')
    .setVersion('1.0')
    .addTag('Auth')
    .addTag('Search')
    .addTag('Channels')
    .addTag('Videos')
    .addTag('Analytics')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const isSaslEnabled = !!configService.get<string>('KAFKA_SASL_USER');
  const brokers =
    configService.get<string>('KAFKA_BROKERS') || 'broker.octanebrew.dev:8085';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: brokers.split(','),
        connectionTimeout: 20000,
        requestTimeout: 60000,
        sasl: isSaslEnabled
          ? {
              mechanism: 'plain',
              username: configService.get<string>('KAFKA_SASL_USER')!,
              password: configService.get<string>('KAFKA_SASL_PASS')!,
            }
          : undefined,
      },
      consumer: {
        groupId: configService.get<string>(
          'KAFKA_API_CONSUMER_GROUP_ID',
          'openstream-api-consumer',
        ),
        maxPollInterval: 300000,
        sessionTimeout: 60000,
      },
      subscribe: {
        fromBeginning: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');

  console.log(`[VOD] Backend listening on port ${process.env.PORT ?? 4000}`);
}
void bootstrap();
