import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UploadDocument = Upload & Document;

export enum UploadStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

export enum UploadType {
  VIDEO = 'video',
  THUMBNAIL = 'thumbnail',
  AVATAR = 'avatar',
  BANNER = 'banner',
}

@Schema({ timestamps: true })
export class Upload {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: UploadType, required: true })
  type: UploadType;

  @Prop({ type: String, enum: UploadStatus, default: UploadStatus.UPLOADING })
  status: UploadStatus;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ type: String, default: null })
  fileUrl: string | null;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ type: String, default: null })
  originalFilename: string | null;

  @Prop({ default: 0 })
  fileSize: number;

  createdAt: Date;
  updatedAt: Date;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);
