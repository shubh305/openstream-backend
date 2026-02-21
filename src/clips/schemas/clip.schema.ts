import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClipDocument = Clip & Document;

export enum ClipStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Clip {
  @Prop({ type: String, required: true, unique: true, index: true })
  clipId: string;

  @Prop({ type: Types.ObjectId, ref: 'Video', required: true, index: true })
  parentVideoId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Number, required: true })
  start: number;

  @Prop({ type: Number, required: true })
  end: number;

  @Prop({ type: Number, required: true })
  duration: number;

  @Prop({ type: Number, required: true })
  score: number;

  @Prop({
    type: {
      audio: { type: Boolean, default: false },
      scene: { type: Boolean, default: false },
      chat: { type: Boolean, default: false },
      ocr: { type: Boolean, default: false },
    },
    default: {},
  })
  signals: {
    audio: boolean;
    scene: boolean;
    chat: boolean;
    ocr: boolean;
  };

  @Prop({
    type: String,
    enum: ClipStatus,
    default: ClipStatus.PROCESSING,
  })
  status: ClipStatus;

  @Prop({ type: String, required: true })
  rawPath: string;

  @Prop({ type: String, default: null })
  hlsManifest: string | null;

  @Prop({ type: String, required: true })
  thumbnailUrl: string;

  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: Date, default: null })
  readyAt: Date | null;
}

export const ClipSchema = SchemaFactory.createForClass(Clip);

// Compound indexes can be added if needed
ClipSchema.index({ parentVideoId: 1, start: 1 });
