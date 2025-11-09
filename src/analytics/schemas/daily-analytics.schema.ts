import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyAnalyticsDocument = DailyAnalytics & Document;

@Schema({ timestamps: true })
export class DailyAnalytics {
  @Prop({ type: Types.ObjectId, ref: 'Channel', required: true, index: true })
  channelId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Video', default: null, index: true })
  videoId: Types.ObjectId | null;

  @Prop({ required: true, index: true })
  date: string; // YYYY-MM-DD format

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  comments: number;

  @Prop({ default: 0 })
  shares: number;

  @Prop({ default: 0 })
  watchTimeSeconds: number;

  @Prop({ default: 0 })
  newSubscribers: number;

  createdAt: Date;
  updatedAt: Date;
}

export const DailyAnalyticsSchema =
  SchemaFactory.createForClass(DailyAnalytics);

// Compound index for efficient upsert (channel + date + video)
DailyAnalyticsSchema.index(
  { channelId: 1, date: 1, videoId: 1 },
  { unique: true },
);
