import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { Playlist, PlaylistSchema } from './schemas/playlist.schema';
import {
  PlaylistItem,
  PlaylistItemSchema,
} from './schemas/playlist-item.schema';
import { ChannelsModule } from '../channels/channels.module';
import { UsersModule } from '../users/users.module';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Playlist.name, schema: PlaylistSchema },
      { name: PlaylistItem.name, schema: PlaylistItemSchema },
    ]),
    forwardRef(() => ChannelsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => VideosModule),
  ],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
