import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import * as url from 'url';
import { IncomingMessage } from 'http';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface ChatClient extends WebSocket {
  streamId?: string;
  userId?: string;
  username?: string;
}

interface JwtPayload {
  sub: string;
  username: string;
}

@WebSocketGateway({ path: '/ws/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(ChatGateway.name);
  private roomClients = new Map<string, Set<ChatClient>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: ChatClient, request: IncomingMessage) {
    try {
      if (!request.url) {
        client.close(1008, 'Missing URL');
        return;
      }

      const parameters = url.parse(request.url, true);

      let streamId = parameters.query.streamId as string;

      if (!streamId) {
        const pathParts = parameters.pathname?.split('/').filter(Boolean) || [];
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== 'chat') {
          streamId = lastPart;
        }
      }

      const token = parameters.query.token as string;

      if (!streamId) {
        client.close(1008, 'Missing stream ID');
        return;
      }

      client.streamId = streamId;

      if (token) {
        try {
          const payload = this.jwtService.verify<JwtPayload>(token);
          client.userId = payload.sub;
          client.username = payload.username;
        } catch {
          // Anonymous users can still watch
        }
      }

      if (!this.roomClients.has(streamId)) {
        this.roomClients.set(streamId, new Set());
      }
      this.roomClients.get(streamId)!.add(client);

      this.logger.log(`Client connected to chat: ${streamId}`);
      this.broadcastUserCount(streamId);
    } catch (error) {
      this.logger.error(`Connection error: ${error}`);
      client.close(1011, 'Connection error');
    }
  }

  handleDisconnect(client: ChatClient) {
    if (client.streamId) {
      const room = this.roomClients.get(client.streamId);
      if (room) {
        room.delete(client);
        if (room.size === 0) {
          this.roomClients.delete(client.streamId);
        } else {
          this.broadcastUserCount(client.streamId);
        }
      }
      this.logger.log(`Client disconnected from chat: ${client.streamId}`);
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: ChatClient,
    @MessageBody() data: { text: string },
  ) {
    if (!client.userId || !client.streamId) {
      return;
    }

    if (!data.text || data.text.trim().length === 0) {
      return;
    }

    if (data.text.length > 500) {
      return;
    }

    const badges = this.chatService.getUserBadges(
      client.streamId,
      client.userId,
    );

    const message = await this.chatService.saveMessage(
      client.streamId,
      client.userId,
      data.text.trim(),
      badges,
    );

    this.broadcastToRoom(client.streamId, {
      type: 'message',
      data: message,
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: ChatClient) {
    client.send(JSON.stringify({ type: 'pong' }));
  }

  private broadcastToRoom(streamId: string, message: unknown) {
    const room = this.roomClients.get(streamId);
    if (room) {
      const messageStr = JSON.stringify(message);
      room.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }

  private broadcastUserCount(streamId: string) {
    const room = this.roomClients.get(streamId);
    const count = room?.size || 0;

    this.broadcastToRoom(streamId, {
      type: 'user_count',
      data: {
        count,
        formatted: this.formatCount(count),
      },
    });
  }

  private formatCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Broadcast system message to a room
   */
  broadcastSystemMessage(streamId: string, text: string) {
    this.broadcastToRoom(streamId, {
      type: 'system',
      data: { text },
    });
  }
}
