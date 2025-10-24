import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoLikeDocument = VideoLike & Document;

@Schema({ timestamps: true })
export class VideoLike {
  @Prop({ type: Types.ObjectId, ref: 'Video', required: true })
  videoId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['like', 'dislike'], required: true })
  type: 'like' | 'dislike';

  createdAt: Date;
}

export const VideoLikeSchema = SchemaFactory.createForClass(VideoLike);

// Compound unique index to prevent duplicate likes
VideoLikeSchema.index({ videoId: 1, userId: 1 }, { unique: true });
