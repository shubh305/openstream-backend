import {
  Inject,
  Injectable,
  Logger,
  NestMiddleware,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { Server } from '@tus/server';
import { EVENTS } from '@tus/utils';
import type { Upload } from '@tus/utils';
import { S3Store } from '@tus/s3-store';
import type { Request, Response } from 'express';
import { TusSession, TusSessionService } from './tus-session.service';
import { PIPELINE_TOPICS } from '../events/pipeline-events';

interface TranscodePayload {
  videoId: string;
  ownerId: string;
  sessionId: string;
  storagePath: string | undefined;
  sizeBytes: number;
  originalFilename: string;
  ts: number;
}

@Injectable()
export class TusMiddleware implements NestMiddleware, OnModuleInit {
  private readonly logger = new Logger(TusMiddleware.name);
  private tusServer: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: TusSessionService,
    @Inject('VOD_WORKER_SERVICE')
    private readonly workerClient: ClientKafka,
  ) {
    const minioEndpoint = this.config.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const minioPort = this.config.get<number>('MINIO_PORT', 9000);
    const minioUser = this.config.get<string>('MINIO_ROOT_USER', 'minioadmin');
    const minioPass = this.config.get<string>(
      'MINIO_ROOT_PASSWORD',
      'minioadmin',
    );

    const s3Store = new S3Store({
      partSize: this.config.get<number>('TUS_CHUNK_SIZE_MB', 5) * 1024 * 1024,
      s3ClientConfig: {
        bucket: 'openstream-uploads',
        endpoint: `http://${minioEndpoint}:${minioPort}`,
        forcePathStyle: true,
        credentials: {
          accessKeyId: minioUser,
          secretAccessKey: minioPass,
        },
        region: 'us-east-1',
      },
    });

    this.tusServer = new Server({
      path: '/api/vod-upload/tus',
      datastore: s3Store,
      respectForwardedHeaders: true,
      maxSize: this.sessionService.getMaxUploadBytes(),
      onUploadFinish: async (_req, upload: Upload) => {
        this.logger.log(
          `TUS upload finished: ${upload.id}, ${upload.size} bytes`,
        );

        const sessionId = upload.metadata?.sessionId;
        if (sessionId) {
          const session: TusSession | undefined =
            await this.sessionService.completeSession(sessionId);
          if (session) {
            const transcodePayload: TranscodePayload = {
              videoId: session.videoId,
              ownerId: session.userId,
              sessionId: session.sessionId,
              storagePath: upload.id,
              sizeBytes: session.sizeBytes,
              originalFilename: session.fileName,
              ts: Date.now(),
            };

            this.workerClient.emit(
              PIPELINE_TOPICS.VOD_TRANSCODE_FAST,
              transcodePayload,
            );

            this.workerClient.emit('vod.transcode.slow', transcodePayload);

            this.logger.log(
              `Dispatched fast + slow lane jobs for video ${session.videoId}`,
            );
          }
        }

        return {};
      },
    });

    this.tusServer.on(EVENTS.POST_CREATE, (_req, upload: Upload) => {
      this.logger.log(`TUS upload created: ${upload.id}`);
    });
  }

  async onModuleInit() {
    this.workerClient.subscribeToResponseOf(PIPELINE_TOPICS.VOD_TRANSCODE_FAST);
    this.workerClient.subscribeToResponseOf('vod.transcode.slow');
    await this.workerClient.connect();
    this.logger.log('VodWorker microservice client connected.');
  }

  use(req: Request, res: Response) {
    this.logger.debug(
      `TUS Request: ${req.method} ${req.url} (original: ${req.originalUrl || req.url})`,
    );

    if (req.originalUrl) {
      req.url = req.originalUrl;
    }

    void this.tusServer.handle(req, res);
  }
}
