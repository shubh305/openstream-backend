export interface ClipTranscodeEvent {
  clipId: string;
  parentVideoId: string;
  rawPath: string; // MinIO path to stream-copy MP4
  crfValue: number; // Inherited from parent video encoding.crf
  ts: number;
}

export interface ClipReadyEvent {
  clipId: string;
  hlsManifest: string; // MinIO path to index.m3u8
  ts: number;
}

export interface ClipFailedEvent {
  clipId: string;
  reason: string;
  ts: number;
}

export const CLIP_TOPICS = {
  TRANSCODE_REQUEST: process.env.KAFKA_TOPIC_CLIP_TRANSCODE || 'clip.transcode',
  READY: process.env.KAFKA_TOPIC_CLIP_READY || 'clip.ready',
  FAILED: process.env.KAFKA_TOPIC_CLIP_FAILED || 'clip.failed',
};
