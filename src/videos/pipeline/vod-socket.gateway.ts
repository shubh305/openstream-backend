import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

interface VideoStatusUpdate {
  status: string;
  hlsManifest?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolutions?: string[];
  error?: string;
}

/**
 * WebSocket gateway for real-time VOD pipeline status updates.
 */
@WebSocketGateway({ path: '/ws/vod-status' })
export class VodSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VodSocketGateway.name);

  private subscriptions = new Map<string, Set<WebSocket>>();

  handleConnection(client: WebSocket) {
    this.logger.debug('VOD status client connected');

    client.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          videoId?: string;
        };

        if (msg.type === 'subscribe' && msg.videoId) {
          this.subscribe(msg.videoId, client);
        }

        if (msg.type === 'unsubscribe' && msg.videoId) {
          this.unsubscribe(msg.videoId, client);
        }
      } catch {
        // Ignore
      }
    });
  }

  handleDisconnect(client: WebSocket) {
    this.logger.debug('VOD status client disconnected');

    for (const [videoId, clients] of this.subscriptions.entries()) {
      clients.delete(client);
      if (clients.size === 0) {
        this.subscriptions.delete(videoId);
      }
    }
  }

  /**
   * Push a status update to all clients subscribed to a videoId.
   */
  notifyVideoStatus(videoId: string, update: VideoStatusUpdate) {
    const clients = this.subscriptions.get(videoId);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify({
      type: 'status',
      videoId,
      ...update,
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }

    this.logger.debug(
      `Pushed status update for ${videoId} to ${clients.size} client(s)`,
    );
  }

  private subscribe(videoId: string, client: WebSocket) {
    if (!this.subscriptions.has(videoId)) {
      this.subscriptions.set(videoId, new Set());
    }
    this.subscriptions.get(videoId)!.add(client);
    this.logger.debug(`Client subscribed to video ${videoId}`);
  }

  private unsubscribe(videoId: string, client: WebSocket) {
    const clients = this.subscriptions.get(videoId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.subscriptions.delete(videoId);
      }
    }
  }
}
