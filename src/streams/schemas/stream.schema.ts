import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StreamDocument = Stream & Document;

export enum StreamStatus {
  OFFLINE = 'offline',
  STARTING = 'starting',
  LIVE = 'live',
  ENDING = 'ending',
}

export enum StreamVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

export enum LatencyMode {
  NORMAL = 'normal',
  LOW = 'low',
  ULTRA = 'ultra',
}

export enum StreamCategory {
  GAMING = 'Gaming',
  MUSIC = 'Music',
  TALK_PODCASTS = 'Talk & Podcasts',
  SPORTS = 'Sports',
  CREATIVE = 'Creative',
  EDUCATION = 'Education',
  TECHNOLOGY = 'Technology',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Stream {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: 'Untitled Stream' })
  title: string;

  @Prop({ type: String, enum: StreamCategory, default: StreamCategory.OTHER })
  category: StreamCategory;

  @Prop({
    type: String,
    enum: StreamVisibility,
    default: StreamVisibility.PUBLIC,
  })
  visibility: StreamVisibility;

  @Prop({
    type: String,
    enum: LatencyMode,
    default: LatencyMode.NORMAL,
  })
  latencyMode: LatencyMode;

  @Prop({
    type: String,
    enum: StreamStatus,
    default: StreamStatus.OFFLINE,
  })
  status: StreamStatus;

  @Prop({ type: String, default: null })
  thumbnailUrl: string | null;

  @Prop({ default: 0 })
  viewerCount: number;

  @Prop({ default: 0 })
  peakViewerCount: number;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop({ type: String, default: null })
  streamKey: string | null;

  @Prop({ type: String, default: null })
  hlsPlaybackUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const StreamSchema = SchemaFactory.createForClass(Stream);

// Indexes
StreamSchema.index({ userId: 1, status: 1 });
StreamSchema.index({ status: 1, visibility: 1 });
