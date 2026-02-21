import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Clip, ClipSchema } from './schemas/clip.schema';
import { ClipsService } from './clips.service';
import { ClipsController } from './clips.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Clip.name, schema: ClipSchema }]),
    ConfigModule,
  ],
  controllers: [ClipsController],
  providers: [ClipsService],
  exports: [MongooseModule],
})
export class ClipsModule {}
