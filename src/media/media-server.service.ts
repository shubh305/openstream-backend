import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { VideoProcessingService } from './video-processing.service';
import { AuthService } from '../auth/auth.service';
import * as path from 'path';
import * as fs from 'fs';
import NodeMediaServer from 'node-media-server';

interface NMSSession {
  id: string;
  streamPath: string;
  streamQuery?: Record<string, any>;
  close: () => void;
}

interface NodeMediaServerImpl {
  run(): void;
  stop(): void;
  on(event: string, callback: (session: NMSSession) => void): void;
}

@Injectable()
export class MediaServerService implements OnModuleInit, OnApplicationShutdown {
  private nms: NodeMediaServerImpl;
  private readonly logger = new Logger(MediaServerService.name);

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
    private readonly authService: AuthService,
  ) {}

  onModuleInit() {
    const mediaRoot = path.join(__dirname, '../../media');

    // Ensure media directory exists
    if (!fs.existsSync(mediaRoot)) {
      fs.mkdirSync(mediaRoot, { recursive: true });
      this.logger.log(`Created media directory at: ${mediaRoot}`);
    }

    const config = {
      rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
      },
      http: {
        port: 8000,
        allow_origin: '*',
        mediaroot: mediaRoot,
      },
      trans: {
        ffmpeg: '/opt/homebrew/bin/ffmpeg',
        tasks: [
          {
            app: 'live',
            hls: true,
            hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
            dash: true,
            dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
            mp4: true,
            mp4Flags: '[movflags=frag_keyframe+empty_moov]',
          },
        ],
      },
    };

    this.logger.log(
      `Initializing NodeMediaServer with config: ${JSON.stringify(config)}`,
    );

    this.nms = new NodeMediaServer(config) as unknown as NodeMediaServerImpl;

    this.nms.on('prePublish', (session: NMSSession) => {
      void (async () => {
        try {
          const id = session.id;
          const sessionPath = session.streamPath;

          if (!sessionPath) {
            this.logger.warn(
              `[NodeEvent on prePublish] No StreamPath found for id=${id}`,
            );
            return;
          }

          // Parse Stream Key from path (strip /live/ prefix)
          // Expected format: /live/STREAM_KEY
          const parts = sessionPath.split('/');
          const streamKey = parts[parts.length - 1];

          this.logger.log(
            `[NodeEvent on prePublish] id=${id} StreamPath=${sessionPath} StreamKey=${streamKey}`,
          );

          if (!streamKey) {
            session.close();
            return;
          }

          // Validate Stream Key
          const isValid = await this.authService.validateStreamKey(streamKey);
          if (!isValid) {
            this.logger.error(
              `[NodeEvent on prePublish] Unauthorized stream key: ${streamKey}`,
            );
            session.close();
            return;
          }

          this.logger.log(
            `[NodeEvent on prePublish] Stream authorized: ${streamKey}`,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `[NodeEvent on prePublish] Error validating session: ${message}`,
          );
          session.close();
        }
      })();
    });

    this.nms.on('donePublish', (session: NMSSession) => {
      const id = session.id;
      const sessionPath = session.streamPath;

      this.logger.log(
        `[NodeEvent on donePublish] id=${id} StreamPath=${sessionPath}`,
      );

      // Trigger video processing (remuxing, thumbnails)
      const parts = sessionPath.split('/');
      const streamKey = parts[parts.length - 1];

      if (streamKey) {
        // Construct path to the file NMS recorded
        const mediaRoot = path.join(__dirname, '../../media');
        // NMS with mp4: true records to: /media/live/STREAM_KEY/index.mp4
        const recordedPath = path.join(
          mediaRoot,
          'live',
          streamKey,
          'index.mp4',
        );

        // Allow some time for NMS to finalize the file
        setTimeout(() => {
          void this.videoProcessingService.processAndSaveVideo(
            streamKey,
            recordedPath,
          );
        }, 2000);
      }
    });

    this.nms.run();
    this.logger.log('NodeMediaServer started');
  }

  onApplicationShutdown(signal?: string) {
    if (this.nms) {
      this.nms.stop();
      this.logger.log(`NodeMediaServer stopped (signal: ${signal})`);
    }
  }
}
