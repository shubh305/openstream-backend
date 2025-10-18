import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { ChildProcess, spawn } from 'child_process';
import { Logger } from '@nestjs/common';
import * as url from 'url';
import { IncomingMessage } from 'http';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth/auth.service';

@WebSocketGateway({ path: '/ingest' })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
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

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    this.logger.log(
      `Connection attempt received from ${request.socket.remoteAddress}`,
    );
    this.logger.log(`Headers: ${JSON.stringify(request.headers)}`);

    if (!request.url) {
      client.close(1008, 'Missing URL');
      return;
    }
    const parameters = url.parse(request.url, true);
    const streamKey = parameters.query.key as string;

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

    this.logger.log(
      `Starting FFmpeg for NEW stream: ${streamKey} -> ${rtmpUrl}`,
    );

    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

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
      '30', // Force 30fps
      '-g',
      '30', // 1s GOP
      '-keyint_min',
      '30', // Hard min GOP
      '-sc_threshold',
      '0', // Disable scene detection
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
      this.logger.error(`FFmpeg error: ${err.message}`);
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

    ffmpeg.stderr.on('data', (data: Buffer) => {
      this.logger.debug(`FFmpeg stderr: ${data.toString()}`);
    });

    this.streamSessions.set(streamKey, { ffmpeg, client });
    this.attachMessageHandler(client, ffmpeg);
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
