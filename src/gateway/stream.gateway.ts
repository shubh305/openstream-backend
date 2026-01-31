import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { ChildProcess, spawn } from 'child_process';
import { Logger } from '@nestjs/common';
import * as url from 'url';
import { IncomingMessage } from 'http';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth/auth.service';

@WebSocketGateway({ path: '/ingest' })
export class StreamGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger(StreamGateway.name);
  private streamSessions = new Map<
    string,
    { ffmpeg: ChildProcess; client?: WebSocket; timeout?: NodeJS.Timeout }
  >();

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('StreamGateway Initialized');
  }

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    this.logger.log(`Connection attempt from ${request.socket.remoteAddress}`);

    try {
      if (!request.url) {
        this.logger.log('Missing URL');
        client.close(1008, 'Missing URL');
        return;
      }
      const parameters = url.parse(request.url, true);
      const streamKey = parameters.query.key as string;

      this.logger.log(`Validating key: ${streamKey}`);

      const isValid = await this.authService.validateStreamKey(streamKey);
      if (!streamKey || !isValid) {
        this.logger.error(`Invalid or missing stream key: ${streamKey}`);
        client.close(1008, 'Invalid Stream Key');
        return;
      }

      const session = this.streamSessions.get(streamKey);
      if (session) {
        this.logger.log(`Resuming existing session for stream: ${streamKey}`);

        if (session.timeout) {
          clearTimeout(session.timeout);
          session.timeout = undefined;
          this.logger.log(`Grace period saved session for: ${streamKey}`);
        }

        session.client = client;
        this.attachMessageHandler(client, session.ffmpeg);
        return;
      }

      const ingestBaseUrl = this.configService.get<string>('RTMP_INGEST_URL');
      const rtmpUrl = `${ingestBaseUrl}/${streamKey}`;

      this.logger.log(`Starting FFmpeg: ${streamKey} -> ${rtmpUrl}`);

      const ffmpegPath =
        this.configService.get<string>('FFMPEG_PATH') || '/usr/bin/ffmpeg';

      const ffmpeg = spawn(ffmpegPath, [
        '-i',
        'pipe:0',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-tune',
        'zerolatency',
        '-r',
        '30',
        '-g',
        '30',
        '-keyint_min',
        '30',
        '-sc_threshold',
        '0',
        '-c:a',
        'aac',
        '-ar',
        '44100',
        '-b:a',
        '128k',
        '-f',
        'flv',
        rtmpUrl,
      ]);

      ffmpeg.on('error', (err) => {
        this.logger.error(`FFmpeg spawn error: ${err.message}`, err.stack);
        client.close(1011, 'FFmpeg error');
      });

      ffmpeg.on('close', (code) => {
        this.logger.log(`FFmpeg process exited with code ${code}`);
        if (this.streamSessions.get(streamKey)?.ffmpeg === ffmpeg) {
          this.streamSessions.delete(streamKey);
        }
      });

      ffmpeg.stdin.on('error', (err: unknown) => {
        const error = err as { code?: string; message: string };
        if (error.code !== 'EPIPE') {
          this.logger.error(`FFmpeg stdin error: ${error.message}`);
        }
      });

      ffmpeg.stderr.on('data', () => {});

      this.streamSessions.set(streamKey, { ffmpeg, client });
      this.attachMessageHandler(client, ffmpeg);

      this.logger.log(`Session created for ${streamKey}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `handleConnection Exception: ${error.message}`,
        error.stack,
      );
      client.close(1011, 'Internal Error');
    }
  }

  handleDisconnect(client: WebSocket) {
    for (const [streamKey, session] of this.streamSessions.entries()) {
      if (session.client === client) {
        this.logger.log(
          `Client disconnected for stream: ${streamKey}. Starting 10s grace period...`,
        );
        session.client = undefined;

        session.timeout = setTimeout(() => {
          this.logger.log(
            `Grace period expired for ${streamKey}. Killing FFmpeg.`,
          );
          session.ffmpeg.stdin?.end();
          session.ffmpeg.kill('SIGINT');
          this.streamSessions.delete(streamKey);
        }, 10000); // 10 seconds

        break;
      }
    }
  }

  private attachMessageHandler(client: WebSocket, ffmpeg: ChildProcess) {
    client.on('message', (message: any) => {
      if (ffmpeg.stdin && !ffmpeg.killed && ffmpeg.stdin.writable) {
        try {
          ffmpeg.stdin.write(message);
        } catch (err) {
          this.logger.debug(
            `Failed to write to ffmpeg stdin: ${(err as Error).message}`,
          );
        }
      }
    });
  }
}
