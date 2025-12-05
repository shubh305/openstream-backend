import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatMessage,
  ChatMessageDocument,
} from './schemas/chat-message.schema';
import { UsersRepository } from '../users/users.repository';
import { StreamsRepository } from '../streams/streams.repository';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private chatMessageModel: Model<ChatMessageDocument>,
    private readonly usersRepository: UsersRepository,
    private readonly streamsRepository: StreamsRepository,
  ) {}

  /**
   * Save a chat message
   */
  async saveMessage(
    streamId: string,
    userId: string,
    text: string,
    badges: string[] = [],
  ) {
    const message = await this.chatMessageModel.create({
      streamId: new Types.ObjectId(streamId),
      userId: new Types.ObjectId(userId),
      text,
      badges,
    });

    const user = await this.usersRepository.findOne({ _id: userId });

    return {
      id: message._id.toString(),
      user: user?.username || 'Unknown',
      avatarUrl: user?.avatar || '',
      text: message.text,
      timestamp: this.formatTime(message.createdAt),
      badges: message.badges,
    };
  }

  /**
   * Get chat history for a stream
   */
  async getHistory(streamId: string, limit: number = 50) {
    const stream = await this.streamsRepository.findById(streamId);

    const query: {
      streamId: Types.ObjectId;
      deleted: boolean;
      createdAt?: { $gte: Date };
    } = {
      streamId: new Types.ObjectId(streamId),
      deleted: false,
    };

    if (stream?.startedAt) {
      query.createdAt = { $gte: stream.startedAt };
    }

    const messages = await this.chatMessageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        const user = await this.usersRepository.findOne({
          _id: msg.userId.toString(),
        });

        return {
          id: msg._id.toString(),
          user: user?.username || 'Unknown',
          avatarUrl: user?.avatar || '',
          text: msg.text,
          timestamp: this.formatTime(msg.createdAt),
          badges: msg.badges,
        };
      }),
    );

    return formattedMessages.reverse();
  }

  /**
   * Delete a message (mod only)
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.chatMessageModel
      .findByIdAndUpdate(messageId, {
        deleted: true,
      })
      .exec();
  }

  /**
   * Ban user from chat
   */
  async banUser(streamId: string, userId: string): Promise<void> {
    await this.chatMessageModel
      .updateMany(
        {
          streamId: new Types.ObjectId(streamId),
          userId: new Types.ObjectId(userId),
        },
        { deleted: true },
      )
      .exec();
  }

  /**
   * Get user badges for a stream (broadcaster, moderator, subscriber)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getUserBadges(_streamId: string, _userId: string): string[] {
    const badges: string[] = [];
    return badges;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
