import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';

import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ChannelsRepository } from './channels.repository';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import { UsersModule } from '../users/users.module';
import { PlaylistsModule } from '../playlists/playlists.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Channel.name, schema: ChannelSchema }]),
    MulterModule.register({
      limits: {
        fileSize: 6 * 1024 * 1024, // 6MB max
      },
    }),
    forwardRef(() => UsersModule),
    forwardRef(() => PlaylistsModule),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsRepository],
  exports: [ChannelsService, ChannelsRepository],
})
export class ChannelsModule {}
