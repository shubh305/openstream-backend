import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { nanoid } from 'nanoid';
import { Video, VideoDocument, VideoStatus } from '../schemas/video.schema';

export interface TusSession {
  sessionId: string;
  videoId: string;
  userId: string;
  channelId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  storagePath: string;
  createdAt: Date;
}

@Injectable()
export class TusSessionService {
  private readonly logger = new Logger(TusSessionService.name);
  private readonly sessions = new Map<string, TusSession>();

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
  ) {}

  /**
   * Create a new TUS upload session after validation.
   * Creates a Video document in UPLOADING status.
   */
  async createSession(
    userId: string,
    channelId: string,
    fileName: string,
    sizeBytes: number,
    mimeType: string,
  ): Promise<TusSession> {
    const sessionId = nanoid(21);
    const storagePath = `uploads/${userId}/${sessionId}/${fileName}`;

    const video = await this.videoModel.create({
      channelId: new Types.ObjectId(channelId),
      userId: new Types.ObjectId(userId),
      title: fileName.replace(/\.[^/.]+$/, ''),
      status: VideoStatus.UPLOADING,
    });

    const session: TusSession = {
      sessionId,
      videoId: video._id.toString(),
      userId,
      channelId,
      fileName,
      sizeBytes,
      mimeType,
      storagePath,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.logger.log(
      `Created TUS session ${sessionId} for video ${session.videoId}`,
    );

    return session;
  }

  /**
   * Retrieve an active session by its ID.
   */
  getSession(sessionId: string): TusSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Mark a session as complete. Updates the video status to UPLOAD_COMPLETE.
   */
  async completeSession(
    sessionId: string,
    storagePath?: string,
  ): Promise<TusSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const update: UpdateQuery<VideoDocument> = {
      status: VideoStatus.UPLOAD_COMPLETE,
    };

    if (storagePath) {
      update.videoUrl = storagePath;
    }

    await this.videoModel.findByIdAndUpdate(session.videoId, update);

    this.logger.log(
      `Completed TUS session ${sessionId} for video ${session.videoId}`,
    );

    return session;
  }

  /**
   * Clean up a session (on abort or after Kafka dispatch).
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get the max upload size from config.
   */
  getMaxUploadBytes(): number {
    return this.config.get<number>('MAX_UPLOAD_BYTES', 5368709120);
  }
}
