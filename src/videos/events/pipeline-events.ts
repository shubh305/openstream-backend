/**
 * Kafka Event Payload Interfaces
 */

/** Emitted by TUS middleware after upload completes */
export interface VideoTranscodeEvent {
  videoId: string;
  ownerId: string;
  sessionId: string;
  storagePath: string;
  sizeBytes: number;
  originalFilename: string;
  ts: number;
}

/** Emitted by FFmpeg Worker fast lane when 480p is ready */
export interface VideoPlayableEvent {
  videoId: string;
  hlsManifest480p: string;
  duration: number;
  thumbnailUrl: string;
  resolutions: string[];
  ts: number;
}

/** Emitted by FFmpeg Worker fast lane to request subtitle generation */
export interface VideoSubtitleRequestEvent {
  videoId: string;
  audioPath: string;
  ts: number;
}

/** Emitted by subtitle consumer when all VTTs are stored */
export interface VideoSubtitleCompleteEvent {
  videoId: string;
  tracks: { lang: string; path: string }[];
  ts: number;
}

/** Emitted by subtitle consumer on partial success (≥1 translation failed) */
export interface VideoSubtitleDegradedEvent {
  videoId: string;
  tracks: { lang: string; path: string }[];
  failedLangs: string[];
  ts: number;
}

/** Emitted by subtitle consumer when transcription itself fails */
export interface VideoSubtitleFailedEvent {
  videoId: string;
  error: string;
  ts: number;
}

/** Emitted to re-trigger semantic ingestion from existing subtitles */
export interface VideoSemanticReindexEvent {
  videoId: string;
  ts: number;
}

/** Emitted by FFmpeg Worker slow lane when all resolutions are ready */
export interface VideoCompleteEvent {
  videoId: string;
  crfUsed: number;
  complexityScore: number;
  resolutions: string[];
  hlsManifest: string;
  thumbnailUrl?: string;
  ts: number;
}

/** Emitted by FFmpeg Worker slow lane after sprite sheet generation */
export interface VideoSpritesCompleteEvent {
  videoId: string;
  failed?: boolean;
  reason?: string;
  spritePath?: string;
  vttPath?: string;
  frameCount?: number;
  interval?: number;
  cols?: number;
  rows?: number;
  ts: number;
}

// --- Highlight Generator Events ---

/** Emitted by OpenStream Backend after video.complete to request highlight generation */
export interface VideoHighlightRequestEvent {
  videoId: string;
  proxy480pPath: string;
  sourceVideoPath: string;
  videoTitle: string;
  videoDescription: string | null;
  chatPath: string | null;
  configPath: string | null;
  videoCategory?: string;
  ownerId: string;
  ts: number;
}

/** Emitted by Highlight Worker when clips + metadata are ready */
export interface VideoHighlightCompleteEvent {
  videoId: string;
  clipCount: number;
  highlightsJsonPath: string;
  durationMs: number;
  vttUsed: boolean;
  warnings: string[];
  ts: number;
}

/** Emitted by Highlight Worker when clips generated but enrichment partial */
export interface VideoHighlightDegradedEvent {
  videoId: string;
  clipCount: number;
  highlightsJsonPath: string;
  durationMs: number;
  warnings: string[];
  ts: number;
}

/** Emitted by Highlight Worker when no clips are generated (job error) */
export interface VideoHighlightFailedEvent {
  videoId: string;
  error: string;
  ts: number;
}

/** Kafka topic constants */
export const PIPELINE_TOPICS = {
  VIDEO_TRANSCODE: 'video.transcode',
  VOD_TRANSCODE_FAST: 'vod.transcode.fast',
  VOD_TRANSCODE_SLOW: 'vod.transcode.slow',
  VIDEO_PLAYABLE: 'video.playable',
  VIDEO_COMPLETE: 'video.complete',
  VIDEO_PROCESSED: 'video.processed',

  // Subtitle Pipeline
  VIDEO_SUBTITLE_REQUESTS: 'video.subtitle.requests',
  VIDEO_SUBTITLE_COMPLETE: 'video.subtitle.complete',
  VIDEO_SUBTITLE_DEGRADED: 'video.subtitle.degraded',
  VIDEO_SUBTITLE_FAILED: 'video.subtitle.failed',

  // Highlight Generator
  VIDEO_HIGHLIGHTS_REQUEST:
    process.env.KAFKA_TOPIC_HIGHLIGHTS_REQUEST || 'video.highlights.request',
  VIDEO_HIGHLIGHTS_COMPLETE:
    process.env.KAFKA_TOPIC_HIGHLIGHTS_COMPLETE || 'video.highlights.complete',
  VIDEO_HIGHLIGHTS_DEGRADED:
    process.env.KAFKA_TOPIC_HIGHLIGHTS_DEGRADED || 'video.highlights.degraded',
  VIDEO_HIGHLIGHTS_FAILED:
    process.env.KAFKA_TOPIC_HIGHLIGHTS_FAILED || 'video.highlights.failed',

  // Sprite Thumbnails
  VIDEO_SPRITES_COMPLETE:
    process.env.KAFKA_TOPIC_SPRITES_COMPLETE || 'video.sprites.complete',

  // Semantic Search
  VIDEO_SEMANTIC_REINDEX:
    process.env.KAFKA_TOPIC_SEMANTIC_REINDEX || 'video.semantic.reindex',
} as const;

/** Oplog task types for Postgres */
export const OPLOG_TASKS = {
  FAST_LANE: 'fast_lane',
  SLOW_LANE: 'slow_lane',
  SUBTITLE_GENERATE: 'subtitle_generate',
  SUBTITLE_TRANSLATE: 'subtitle_translate',
  HIGHLIGHT_GENERATE: 'highlight_generate',
} as const;
