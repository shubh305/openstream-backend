import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const prefix = configService.get<string>('API_PREFIX') || 'api';

  app.setGlobalPrefix(prefix);
  app.enableCors();

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

  const isSaslEnabled = !!process.env.KAFKA_SASL_USER;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'broker.octanebrew.dev:8084'],
        connectionTimeout: 10000,
        requestTimeout: 30000,
        sasl: isSaslEnabled
          ? {
              mechanism: 'plain',
              username: process.env.KAFKA_SASL_USER!,
              password: process.env.KAFKA_SASL_PASS!,
            }
          : undefined,
      },
      consumer: {
        groupId: 'api-consumer',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
void bootstrap();
