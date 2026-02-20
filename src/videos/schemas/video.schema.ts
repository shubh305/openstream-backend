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
  UPLOADING = 'uploading',
  UPLOAD_COMPLETE = 'upload_complete',
  PROCESSING = 'processing',
  PLAYABLE = 'playable',
  PUBLISHED = 'published',
  COMPLETE = 'complete',
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

/** Subtitle Pipeline states */
export enum SubtitleStatus {
  PENDING = 'SUBTITLE_PENDING',
  PROCESSING = 'SUBTITLE_PROCESSING',
  TRANSCRIBED = 'SUBTITLE_TRANSCRIBED',
  TRANSLATING = 'SUBTITLE_TRANSLATING',
  COMPLETE = 'SUBTITLE_COMPLETE',
  DEGRADED = 'SUBTITLE_DEGRADED',
  FAILED = 'SUBTITLE_FAILED',
}

/** Highlight Generator states */
export enum HighlightStatus {
  PENDING = 'HIGHLIGHTS_PENDING',
  QUEUED = 'HIGHLIGHTS_QUEUED',
  PROCESSING = 'HIGHLIGHTS_PROCESSING',
  COMPLETE = 'HIGHLIGHTS_COMPLETE',
  DEGRADED = 'HIGHLIGHTS_DEGRADED',
  FAILED = 'HIGHLIGHTS_FAILED',
}

/** Sprite Thumbnail states */
export enum SpriteStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/** Embedded highlight clip metadata */
export interface HighlightClip {
  index: number;
  start: number;
  end: number;
  score: number;
  title: string;
  signals: Record<string, number>;
  clipUrl: string;
  thumbnailUrl: string;
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

  @Prop({ type: Date, default: null })
  playableAt: Date | null;

  @Prop({ type: Date, default: null })
  completeAt: Date | null;

  @Prop({
    type: {
      crf: { type: Number, default: 0 },
      complexityScore: { type: Number, default: 0 },
      resolutions: { type: [String], default: [] },
    },
    _id: false,
    default: {},
    required: true,
  })
  encoding: {
    crf: number;
    complexityScore: number;
    resolutions: string[];
  };

  // --- Subtitle Pipeline ---

  @Prop({ type: Map, of: String, default: {} })
  subtitles: Map<string, string>;

  @Prop({ default: false })
  accessibilityCompliant: boolean;

  @Prop({
    type: String,
    enum: SubtitleStatus,
    default: SubtitleStatus.PENDING,
  })
  subtitleStatus: SubtitleStatus;

  @Prop({ type: Date, default: null })
  subtitleGeneratedAt: Date | null;

  // --- Highlight Generator ---

  @Prop({
    type: String,
    enum: HighlightStatus,
    default: HighlightStatus.PENDING,
  })
  highlightStatus: HighlightStatus;

  @Prop({ type: [Object], default: [] })
  highlights: HighlightClip[];

  @Prop({ type: Date, default: null })
  highlightsGeneratedAt: Date | null;

  @Prop({ type: String, default: null })
  highlightsJsonPath: string | null;

  @Prop({ type: [String], default: [] })
  clips: string[];

  // --- Sprite Thumbnails ---

  @Prop({
    type: {
      status: {
        type: String,
        enum: SpriteStatus,
        default: SpriteStatus.PENDING,
      },
      spriteUrl: { type: String, default: null },
      vttUrl: { type: String, default: null },
      interval: { type: Number, default: null },
      cols: { type: Number, default: null },
      rows: { type: Number, default: null },
      frameCount: { type: Number, default: null },
      readyAt: { type: Date, default: null },
    },
    _id: false,
    default: () => ({ status: SpriteStatus.PENDING }),
  })
  sprites: {
    status: SpriteStatus;
    spriteUrl: string | null;
    vttUrl: string | null;
    interval: number | null;
    cols: number | null;
    rows: number | null;
    frameCount: number | null;
    readyAt: Date | null;
  };

  // --- General ---

  @Prop({ default: false })
  isLive: boolean;

  @Prop({ type: String, default: null })
  hlsManifest: string | null;

  @Prop({
    type: {
      summary: { type: String, default: null },
      entities: { type: [String], default: [] },
      keyMoments: {
        type: [
          {
            time: { type: Number },
            description: { type: String },
          },
        ],
        default: [],
      },
      topic: { type: String, default: null },
    },
    _id: false,
    default: null,
  })
  aiMetadata: {
    summary: string | null;
    entities: string[];
    keyMoments: { time: number; description: string }[];
    topic: string | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);

// Indexes for efficient querying
VideoSchema.index({ channelId: 1, status: 1 });
VideoSchema.index({ visibility: 1, status: 1, publishedAt: -1 });
VideoSchema.index({ views: -1 });
VideoSchema.index({ title: 'text', description: 'text' });
