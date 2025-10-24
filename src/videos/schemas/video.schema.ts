import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

export enum VideoStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export enum VideoCategory {
  GAMING = 'Gaming',
  MUSIC = 'Music',
  ENTERTAINMENT = 'Entertainment',
  EDUCATION = 'Education',
  SPORTS = 'Sports',
  TECH = 'Tech',
  VLOGS = 'Vlogs',
  OTHER = 'Other',
}

@Schema({ timestamps: true })
export class Video {
  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 100 })
  title: string;

  @Prop({ default: '', maxlength: 5000 })
  description: string;

  @Prop({ type: String, default: null })
  thumbnailUrl: string | null;

  @Prop({ type: String, default: null })
  posterUrl: string | null;

  @Prop({ type: String, default: null })
  videoUrl: string | null;

  @Prop({ default: 0 })
  duration: number; // in seconds

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  dislikes: number;

  @Prop({
    type: String,
    enum: VideoVisibility,
    default: VideoVisibility.PRIVATE,
  })
  visibility: VideoVisibility;

  @Prop({
    type: String,
    enum: VideoCategory,
    default: VideoCategory.OTHER,
  })
  category: VideoCategory;

  @Prop({
    type: String,
    enum: VideoStatus,
    default: VideoStatus.DRAFT,
  })
  status: VideoStatus;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);

// Indexes for efficient querying
VideoSchema.index({ channelId: 1, status: 1 });
VideoSchema.index({ visibility: 1, status: 1, publishedAt: -1 });
VideoSchema.index({ views: -1 });
VideoSchema.index({ title: 'text', description: 'text' });
