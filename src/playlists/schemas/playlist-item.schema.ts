import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlaylistItemDocument = PlaylistItem & Document;

@Schema({ timestamps: true })
export class PlaylistItem {
  @Prop({ type: Types.ObjectId, ref: 'Playlist', required: true, index: true })
  playlistId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Video', required: true })
  videoId: Types.ObjectId;

  @Prop({ required: true })
  order: number;

  createdAt: Date;
}

export const PlaylistItemSchema = SchemaFactory.createForClass(PlaylistItem);

// Compound unique index
PlaylistItemSchema.index({ playlistId: 1, videoId: 1 }, { unique: true });
PlaylistItemSchema.index({ playlistId: 1, order: 1 });
