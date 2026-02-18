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

/** Kafka topic constants */
export const PIPELINE_TOPICS = {
  VIDEO_TRANSCODE: 'video.transcode',
  VOD_TRANSCODE_FAST: 'vod.transcode.fast',
  VOD_TRANSCODE_SLOW: 'vod.transcode.slow',
  VIDEO_PLAYABLE: 'video.playable',
  VIDEO_COMPLETE: 'video.complete',
  VIDEO_PROCESSED: 'video.processed',
  VIDEO_SUBTITLE_REQUESTS: 'video.subtitle.requests',
  VIDEO_SUBTITLE_COMPLETE: 'video.subtitle.complete',
} as const;

/** Oplog task types for Postgres */
export const OPLOG_TASKS = {
  FAST_LANE: 'fast_lane',
  SLOW_LANE: 'slow_lane',
  SUBTITLE_GENERATE: 'subtitle_generate',
} as const;
