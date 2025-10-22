import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChannelDocument = Channel & Document;

@Schema({ _id: false })
export class SocialLinks {
  @Prop({ type: String, default: null })
  twitter: string | null;

  @Prop({ type: String, default: null })
  instagram: string | null;

  @Prop({ type: String, default: null })
  discord: string | null;
}

export const SocialLinksSchema = SchemaFactory.createForClass(SocialLinks);

@Schema({ timestamps: true })
export class Channel {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  handle: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: String, default: null })
  bannerUrl: string | null;

  @Prop({ type: String, default: null })
  location: string | null;

  @Prop({ type: String, default: null })
  contactEmail: string | null;

  @Prop({ type: SocialLinksSchema, default: () => ({}) })
  socialLinks: SocialLinks;

  @Prop({ default: 0 })
  subscriberCount: number;

  @Prop({ default: 0 })
  videoCount: number;

  @Prop({ default: 0 })
  totalViews: number;

  createdAt: Date;
  updatedAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);

// Create indexes
ChannelSchema.index({ handle: 1 });
ChannelSchema.index({ userId: 1 });
ChannelSchema.index({ name: 'text', handle: 'text' });
