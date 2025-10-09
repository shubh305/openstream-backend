import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VodDocument = Vod & Document;

@Schema()
export class Vod {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  path: string;

  @Prop({ required: true })
  thumbnail: string;

  @Prop()
  duration: number;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const VodSchema = SchemaFactory.createForClass(Vod);
