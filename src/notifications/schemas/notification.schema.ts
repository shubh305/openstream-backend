import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  STREAM_ONLINE = 'stream_online',
  NEW_LOGIN = 'new_login',
  STORAGE_WARNING = 'storage_warning',
  UPDATE_APPLIED = 'update_applied',
  NEW_SUBSCRIBER = 'new_subscriber',
  NEW_COMMENT = 'new_comment',
}

export enum NotificationSeverity {
  SUCCESS = 'success',
  WARN = 'warn',
  INFO = 'info',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: false })
  read: boolean;

  @Prop({
    type: String,
    enum: NotificationSeverity,
    default: NotificationSeverity.INFO,
  })
  severity: NotificationSeverity;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Indexes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
