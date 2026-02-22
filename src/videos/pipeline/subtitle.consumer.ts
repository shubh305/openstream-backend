import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientKafka } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { Video, VideoDocument, SubtitleStatus } from '../schemas/video.schema';
import { PIPELINE_TOPICS } from '../events/pipeline-events';
import { StorageService } from '../../storage/storage.service';
import { SemanticSearchService } from '../../search/semantic-search.service';
import type {
  VideoSubtitleRequestEvent,
  VideoSubtitleCompleteEvent,
  VideoSubtitleDegradedEvent,
  VideoSubtitleFailedEvent,
  VideoSemanticReindexEvent,
} from '../events/pipeline-events';

/**
 * SubtitleConsumer
 *
 * Kafka consumer for `video.subtitle.requests` events.
 * Orchestrates the subtitle generation & localization pipeline
 */
@Controller()
export class SubtitleConsumer {
  private readonly logger = new Logger(SubtitleConsumer.name);
  private readonly targetLangs: string[];

  private metrics = {
    jobsTotal: { complete: 0, degraded: 0, failed: 0 },
    tracksGenerated: {} as Record<string, number>,
    failures: { transcription: 0, translation: 0 },
  };

  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    @Inject('VOD_WORKER_SERVICE') private readonly kafkaClient: ClientKafka,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly storageService: StorageService,
    private readonly semanticSearchService: SemanticSearchService,
  ) {
    this.targetLangs = this.configService
      .get<string>('SUBTITLE_TARGET_LANGS', 'es,hi,fr')
      .split(',')
      .map((l) => l.trim());

    this.logger.log(
      `SubtitleConsumer initialized — target languages: ${this.targetLangs.join(', ')}`,
    );
  }

  /**
   * Main Kafka entry point for subtitle generation.
   *
   * This method uses a 'Fire and Forget' pattern: it updates the video status to PROCESSING
   * and acknowledges the Kafka message immediately
   */
  @EventPattern('video.subtitle.requests')
  async handleSubtitleRequest(@Payload() message: Record<string, unknown>) {
    const payload = (message.value ?? message) as VideoSubtitleRequestEvent;

    if (!payload.videoId) {
      this.logger.error('Received subtitle request without videoId');
      return;
    }

    const videoId = payload.videoId;
    this.logger.log(`Queueing subtitle job for ${videoId}`);

    await this.videoModel.findByIdAndUpdate(videoId, {
      $set: { subtitleStatus: SubtitleStatus.PROCESSING },
    });

    // Offload to background process and return immediately to satisfy Kafka
    void this.processTranscription(payload);
  }

  /**
   * Orchestrates the AI pipeline: Transcription -> Semantic Ingestion -> Translation.
   * Runs as a background task to keep the Kafka consumer responsive.
   */
  private async processTranscription(payload: VideoSubtitleRequestEvent) {
    const { videoId, audioPath } = payload;
    try {
      // 1. Transcribe audio using whisper
      const whisperUrl =
        this.configService.get<string>('WHISPER_SERVICE_URL') || '';
      const transcriptionStart = Date.now();
      const enVtt = await this.transcribeAudio(whisperUrl, audioPath, videoId);
      const transcriptionMs = Date.now() - transcriptionStart;

      this.logger.log(
        `Transcription finished for ${videoId} in ${(transcriptionMs / 1000).toFixed(2)}s`,
      );

      if (!enVtt) {
        throw new Error('Whisper transcription returned empty VTT');
      }

      await this.videoModel.findByIdAndUpdate(videoId, {
        $set: { subtitleStatus: SubtitleStatus.TRANSCRIBED },
      });

      // 2. Upload English VTT to MinIO
      const enVttPath = `subtitles/${videoId}/en.vtt`;
      await this.uploadVtt(enVttPath, enVtt);

      const tracks: { lang: string; path: string }[] = [
        { lang: 'en', path: enVttPath },
      ];
      this.metrics.tracksGenerated['en'] =
        (this.metrics.tracksGenerated['en'] || 0) + 1;

      // 3. Ingest into Semantic Search
      try {
        const video = await this.videoModel.findById(videoId);
        if (video) {
          const cleanTranscript = this.stripVttTimestamps(enVtt);
          await this.semanticSearchService.ingestVideo(
            videoId,
            {
              title: video.title,
              description: video.description || '',
              content: cleanTranscript,
              category: video.category,
            },
            {
              thumbnailUrl: video.thumbnailUrl,
              duration: video.duration,
              userId: video.userId.toString(),
            },
          );
        }
      } catch (err: unknown) {
        this.logger.error(
          `[ASYNC] Semantic ingestion failed for ${videoId}: ${String(err)}`,
        );
      }

      // 4. Translate to target languages
      await this.videoModel.findByIdAndUpdate(videoId, {
        $set: { subtitleStatus: SubtitleStatus.TRANSLATING },
      });

      const failedLangs: string[] = [];
      const intelligenceUrl = this.configService.get<string>(
        'INTELLIGENCE_SVC_URL',
        '',
      );
      const apiKey = this.configService.get<string>('SERVICE_API_KEY', '');

      for (const lang of this.targetLangs) {
        try {
          const translatedVtt = await this.translateVtt(
            intelligenceUrl,
            apiKey,
            enVtt,
            lang,
          );

          if (translatedVtt) {
            const translatedPath = `subtitles/${videoId}/${lang}.vtt`;
            await this.uploadVtt(translatedPath, translatedVtt);
            tracks.push({ lang, path: translatedPath });
            this.metrics.tracksGenerated[lang] =
              (this.metrics.tracksGenerated[lang] || 0) + 1;
          } else {
            failedLangs.push(lang);
          }
        } catch (error) {
          this.logger.warn(
            `[ASYNC] Translation to ${lang} failed for ${videoId}: ${String(error)}`,
          );
          failedLangs.push(lang);
          this.metrics.failures.translation++;
        }
      }

      // 5. Finalize status and emit completion event
      if (failedLangs.length > 0) {
        const event: VideoSubtitleDegradedEvent = {
          videoId,
          tracks,
          failedLangs,
          ts: Date.now(),
        };
        this.kafkaClient.emit(PIPELINE_TOPICS.VIDEO_SUBTITLE_DEGRADED, event);
        this.logger.warn(
          `Subtitle DEGRADED for ${videoId}: failed langs: ${failedLangs.join(', ')}`,
        );
      } else {
        const event: VideoSubtitleCompleteEvent = {
          videoId,
          tracks,
          ts: Date.now(),
        };
        this.kafkaClient.emit(PIPELINE_TOPICS.VIDEO_SUBTITLE_COMPLETE, event);
        this.metrics.jobsTotal.complete++;
        this.logger.log(`Subtitle pipeline COMPLETE for ${videoId}`);
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Background subtitle processing failed for ${videoId}: ${errMessage}`,
      );
      this.metrics.jobsTotal.failed++;

      const failedEvent: VideoSubtitleFailedEvent = {
        videoId,
        error: errMessage,
        ts: Date.now(),
      };
      this.kafkaClient.emit(PIPELINE_TOPICS.VIDEO_SUBTITLE_FAILED, failedEvent);
    }
  }

  @EventPattern('video.semantic.reindex')
  async handleSemanticReindex(@Payload() message: Record<string, unknown>) {
    const rawPayload = message.value ?? message;
    const payload = rawPayload as VideoSemanticReindexEvent;
    const videoId = payload.videoId;

    this.logger.log(`Received semantic reindex request for ${videoId}`);

    try {
      const video = await this.videoModel.findById(videoId);
      if (!video) {
        this.logger.error(`Video ${videoId} not found for reindex`);
        return;
      }

      const enVttPath = video.subtitles?.get('en');
      if (!enVttPath) {
        this.logger.warn(
          `No English VTT found for ${videoId} — cannot reindex`,
        );
        return;
      }

      // Download VTT from storage
      const bucket = this.configService.get<string>(
        'MINIO_BUCKET',
        'openstream-uploads',
      );
      const url = await this.storageService.getPresignedUrl(bucket, enVttPath);
      const response = await this.httpService.axiosRef.get(url);
      const enVtt = response.data as string;

      if (!enVtt) {
        throw new Error('VTT file is empty or could not be read');
      }

      const cleanTranscript = this.stripVttTimestamps(enVtt);

      await this.semanticSearchService.ingestVideo(
        videoId,
        {
          title: video.title,
          description: video.description || '',
          content: cleanTranscript,
        },
        {
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration,
          userId: video.userId.toString(),
        },
      );

      this.logger.log(`Successfully reindexed ${videoId} into semantic search`);
    } catch (err) {
      this.logger.error(`Failed to reindex ${videoId}: ${String(err)}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  Whisper Transcription
  // ─────────────────────────────────────────────────────────

  private async transcribeAudio(
    whisperUrl: string,
    audioPath: string,
    videoId: string,
  ): Promise<string | null> {
    try {
      this.logger.log(`Transcribing audio for ${videoId} via ${whisperUrl}`);

      // 1. Download the audio file from the storage URL
      const audioResponse = await this.httpService.axiosRef.get<ArrayBuffer>(
        audioPath,
        {
          responseType: 'arraybuffer',
        },
      );
      const audioBuffer = Buffer.from(audioResponse.data);

      // 2. Prepare FormData with the audio file
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([audioBuffer], { type: 'audio/wav' }),
        'audio.wav',
      );
      formData.append('model', 'Systran/faster-whisper-small');
      formData.append('response_format', 'vtt');
      formData.append('language', 'en');
      formData.append('vad_filter', 'true');
      formData.append('temperature', '0.0');
      formData.append('condition_on_previous_text', 'false');

      const response = await this.httpService.axiosRef.post(
        `${whisperUrl}/v1/audio/transcriptions`,
        formData,
        {
          timeout: 14400000,
        },
      );

      return response.data as string;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Whisper transcription failed for ${videoId}: ${errMsg}`,
      );
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  //  VTT Translation via Intelligence Service
  // ─────────────────────────────────────────────────────────

  private async translateVtt(
    intelligenceUrl: string,
    apiKey: string,
    vttContent: string,
    targetLang: string,
  ): Promise<string | null> {
    if (!intelligenceUrl) {
      this.logger.warn(
        'Intelligence Service URL not configured — skipping translation',
      );
      return null;
    }

    try {
      const langNames: Record<string, string> = {
        es: 'Spanish',
        hi: 'Hindi',
        fr: 'French',
        de: 'German',
        ja: 'Japanese',
        ko: 'Korean',
        zh: 'Chinese',
        pt: 'Portuguese',
        ar: 'Arabic',
      };
      const langName = langNames[targetLang] || targetLang;

      const response = await this.httpService.axiosRef.post(
        `${intelligenceUrl}/v1/chat/completions`,
        {
          system:
            `Translate the following WebVTT subtitle file to ${langName}. ` +
            'Keep the exact VTT formatting, timestamps, and structure. ' +
            'Only translate the subtitle text, not the metadata or timestamps. ' +
            'Return the complete VTT file.',
          prompt: vttContent.substring(0, 10000),
        },
        {
          timeout: 60000,
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      const translated = (
        response.data as { content?: string }
      )?.content?.trim();
      return translated || null;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Translation to ${targetLang} failed: ${errMsg}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  //  MinIO Upload
  // ─────────────────────────────────────────────────────────

  private async uploadVtt(objectPath: string, content: string): Promise<void> {
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'openstream-uploads',
    );

    await this.storageService.upload(
      objectPath,
      Buffer.from(content, 'utf-8'),
      bucket,
      'text/vtt',
    );

    this.logger.log(`Uploaded VTT → ${bucket}/${objectPath}`);
  }

  private stripVttTimestamps(vtt: string): string {
    return vtt
      .replace(/WEBVTT.*\n/g, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  }
}
