import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlaylistDocument = Playlist & Document;

export enum PlaylistVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

@Schema({ timestamps: true })
export class Playlist {
  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 100 })
  title: string;

  @Prop({ type: String, default: null, maxlength: 500 })
  description: string | null;

  @Prop({
    type: String,
    enum: PlaylistVisibility,
    default: PlaylistVisibility.PRIVATE,
  })
  visibility: PlaylistVisibility;

  @Prop({ default: 0 })
  videoCount: number;

  @Prop({ default: false })
  isWatchLater: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const PlaylistSchema = SchemaFactory.createForClass(Playlist);

// Indexes
PlaylistSchema.index({ channelId: 1, visibility: 1 });
PlaylistSchema.index({ userId: 1, isWatchLater: 1 });
