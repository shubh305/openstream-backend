import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';
import { StreamsRepository } from './streams.repository';
import { Stream, StreamSchema } from './schemas/stream.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MediaServerModule } from '../media/media-server.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Stream.name, schema: StreamSchema }]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => MediaServerModule),
  ],
  controllers: [StreamsController],
  providers: [StreamsService, StreamsRepository],
  exports: [StreamsService, StreamsRepository],
})
export class StreamsModule {}
