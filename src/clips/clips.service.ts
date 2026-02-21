import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Clip, ClipDocument, ClipStatus } from './schemas/clip.schema';
import { ConfigService } from '@nestjs/config';

export interface ClipsFilter {
  page?: number;
  limit?: number;
  signal?: string;
  sortBy?: 'score' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ResolvedClip extends Clip {
  _id: string; // From lean() or mongo
  playableUrl: string;
  thumbnailResolvedUrl: string | null;
}

export interface PaginatedClips {
  data: ResolvedClip[];
  total: number;
  page: number;
  lastPage: number;
}

type LeanClip = Clip & { _id: Types.ObjectId };

@Injectable()
export class ClipsService {
  constructor(
    @InjectModel(Clip.name) private readonly clipModel: Model<ClipDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves paginated global clips feed.
   */
  async getClips(filter: ClipsFilter): Promise<PaginatedClips> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { status: ClipStatus.READY };

    if (filter.signal) {
      if (['audio', 'scene', 'chat', 'ocr'].includes(filter.signal)) {
        query[`signals.${filter.signal}`] = true;
      }
    }

    const sortBy = filter.sortBy || 'score';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const total = await this.clipModel.countDocuments(query);
    const clips = await this.clipModel
      .find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .populate('parentVideoId', 'title')
      .lean()
      .exec();

    return {
      data: clips.map((clip) => this.resolveUrls(clip as unknown as LeanClip)),
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves all clips associated with a given video ID.
   */
  async getClipsForVideo(videoId: string): Promise<ResolvedClip[]> {
    const clips = await this.clipModel
      .find({ parentVideoId: new Types.ObjectId(videoId) })
      .sort({ start: 1 })
      .lean()
      .exec();

    return clips.map((clip) => this.resolveUrls(clip as unknown as LeanClip));
  }

  /**
   * Retrieves a single clip by its short ID.
   */
  async getClipById(clipId: string): Promise<ResolvedClip> {
    const clip = await this.clipModel
      .findOne({ clipId })
      .populate('parentVideoId', 'title')
      .lean()
      .exec();

    if (!clip) {
      throw new NotFoundException(`Clip ${clipId} not found`);
    }

    return this.resolveUrls(clip as unknown as LeanClip);
  }

  /**
   * Increments the view count of a clip atomically.
   */
  async incrementViewCount(clipId: string): Promise<{ viewCount: number }> {
    const clip = await this.clipModel.findOneAndUpdate(
      { clipId },
      { $inc: { viewCount: 1 } },
      { new: true },
    );

    if (!clip) {
      throw new NotFoundException(`Clip ${clipId} not found`);
    }

    return { viewCount: clip.viewCount };
  }

  /**
   * Transforms raw S3 paths into full HTTP CDN URLs.
   */
  private resolveUrls(clipObj: LeanClip): ResolvedClip {
    const publicUrl = this.configService.get<string>('STORAGE_PUBLIC_URL');
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'openstream-uploads',
    );

    let baseUrl: string;
    if (publicUrl) {
      baseUrl = `${publicUrl.replace(/\/$/, '')}/${bucket}`;
    } else {
      const minioEndpoint = this.configService.get<string>(
        'MINIO_ENDPOINT',
        'http://localhost:9000',
      );
      let endpoint = minioEndpoint;
      if (!endpoint.startsWith('http')) {
        endpoint = `http://${endpoint}:9000`;
      }
      baseUrl = `${endpoint}/${bucket}`;
    }

    // HLS is primary if READY; fallback to rawPath if PENDING or FAILED
    const playableUrl =
      clipObj.status === ClipStatus.READY && clipObj.hlsManifest
        ? `${baseUrl}/${String(clipObj.hlsManifest)}`
        : `${baseUrl}/${String(clipObj.rawPath)}`;

    const thumbnailUrl = clipObj.thumbnailUrl
      ? `${baseUrl}/${String(clipObj.thumbnailUrl)}`
      : null;

    const { _id, ...rest } = clipObj;

    return {
      ...(rest as any),
      _id: _id.toString(),
      playableUrl,
      thumbnailResolvedUrl: thumbnailUrl,
    } as ResolvedClip;
  }
}
