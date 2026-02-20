import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Video,
  VideoDocument,
  VideoStatus,
  VideoVisibility,
  VideoCategory,
} from './schemas/video.schema';
import { VideoLike, VideoLikeDocument } from './schemas/video-like.schema';

interface VideoFilter {
  channelId?: Types.ObjectId;
  userId?: Types.ObjectId;
  visibility?: VideoVisibility | { $in: VideoVisibility[] };
  status?: VideoStatus | { $in: VideoStatus[] };
  category?: VideoCategory;
  isLive?: any;
}

export interface VideoQueryOptions {
  page: number;
  limit: number;
  sort: 'latest' | 'popular' | 'oldest';
  category?: string;
  channelId?: string;
  userId?: string;
  visibility?: VideoVisibility | { $in: VideoVisibility[] };
  status?: VideoStatus | { $in: VideoStatus[] };
  isLive?: boolean;
}

@Injectable()
export class VideosRepository {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectModel(VideoLike.name)
    private videoLikeModel: Model<VideoLikeDocument>,
  ) {}

  async create(videoData: Partial<Video>): Promise<VideoDocument> {
    const video = new this.videoModel(videoData);
    return video.save();
  }

  async findById(id: string): Promise<VideoDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.videoModel.findById(id).lean().exec();
  }

  async findMany(
    options: VideoQueryOptions,
  ): Promise<{ videos: VideoDocument[]; total: number }> {
    const filter: VideoFilter = {};

    // Default to public published videos
    if (!options.visibility) {
      filter.visibility = VideoVisibility.PUBLIC;
    } else {
      filter.visibility = options.visibility;
    }

    if (!options.status) {
      filter.status = {
        $in: [
          VideoStatus.PUBLISHED,
          VideoStatus.PLAYABLE,
          VideoStatus.COMPLETE,
        ],
      };
    } else {
      filter.status = options.status;
    }

    if (options.category) {
      filter.category = options.category as VideoCategory;
    }

    if (options.channelId) {
      filter.channelId = new Types.ObjectId(options.channelId);
    }

    if (options.userId) {
      filter.userId = new Types.ObjectId(options.userId);
    }

    if (options.isLive !== undefined) {
      if (options.isLive) {
        filter.isLive = true;
      } else {
        filter.isLive = { $ne: true };
      }
    }

    // Sort options
    let sortOption: Record<string, 1 | -1> = { publishedAt: -1, createdAt: -1 };
    if (options.sort === 'popular') {
      sortOption = { views: -1, createdAt: -1 };
    } else if (options.sort === 'oldest') {
      sortOption = { publishedAt: 1, createdAt: 1 };
    }

    const skip = (options.page - 1) * options.limit;

    const [videos, total] = await Promise.all([
      this.videoModel
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(options.limit)
        .lean()
        .exec(),
      this.videoModel.countDocuments(filter).exec(),
    ]);

    return { videos, total };
  }

  async findByChannelId(
    channelId: string,
    limit: number = 12,
  ): Promise<VideoDocument[]> {
    return this.videoModel
      .find({
        channelId: new Types.ObjectId(channelId),
        visibility: VideoVisibility.PUBLIC,
        status: VideoStatus.PUBLISHED,
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findTrending(limit: number = 20): Promise<VideoDocument[]> {
    const searchWindow = new Date();
    searchWindow.setDate(searchWindow.getDate() - 7);

    return this.videoModel
      .find({
        visibility: VideoVisibility.PUBLIC,
        status: {
          $in: [
            VideoStatus.PUBLISHED,
            VideoStatus.PLAYABLE,
            VideoStatus.COMPLETE,
          ],
        },
        $or: [
          { publishedAt: { $gte: searchWindow } },
          { createdAt: { $gte: searchWindow } },
        ],
      })
      .sort({ views: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findRecommendations(
    videoId: string,
    category: string,
    limit: number = 10,
  ): Promise<VideoDocument[]> {
    return this.videoModel
      .find({
        _id: { $ne: new Types.ObjectId(videoId) },
        category,
        visibility: VideoVisibility.PUBLIC,
        status: {
          $in: [
            VideoStatus.PUBLISHED,
            VideoStatus.PLAYABLE,
            VideoStatus.COMPLETE,
          ],
        },
      })
      .sort({ views: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Video>,
  ): Promise<VideoDocument | null> {
    return this.videoModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.videoModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  async incrementViews(id: string): Promise<void> {
    await this.videoModel.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();
  }

  async incrementLikes(id: string, amount: number): Promise<void> {
    await this.videoModel
      .findByIdAndUpdate(id, { $inc: { likes: amount } })
      .exec();
  }

  async incrementDislikes(id: string, amount: number): Promise<void> {
    await this.videoModel
      .findByIdAndUpdate(id, { $inc: { dislikes: amount } })
      .exec();
  }

  // Like/dislike operations
  async findLike(
    videoId: string,
    userId: string,
  ): Promise<VideoLikeDocument | null> {
    return this.videoLikeModel
      .findOne({
        videoId: new Types.ObjectId(videoId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }

  async createLike(
    videoId: string,
    userId: string,
    type: 'like' | 'dislike',
  ): Promise<VideoLikeDocument> {
    const like = new this.videoLikeModel({
      videoId: new Types.ObjectId(videoId),
      userId: new Types.ObjectId(userId),
      type,
    });
    return like.save();
  }

  async updateLike(
    videoId: string,
    userId: string,
    type: 'like' | 'dislike',
  ): Promise<VideoLikeDocument | null> {
    return this.videoLikeModel
      .findOneAndUpdate(
        {
          videoId: new Types.ObjectId(videoId),
          userId: new Types.ObjectId(userId),
        },
        { type },
        { new: true },
      )
      .exec();
  }

  async deleteLike(videoId: string, userId: string): Promise<boolean> {
    const result = await this.videoLikeModel
      .findOneAndDelete({
        videoId: new Types.ObjectId(videoId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    return !!result;
  }

  async search(query: string, limit: number = 20): Promise<VideoDocument[]> {
    return this.videoModel
      .find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
        visibility: VideoVisibility.PUBLIC,
        status: {
          $in: [
            VideoStatus.PUBLISHED,
            VideoStatus.PLAYABLE,
            VideoStatus.COMPLETE,
          ],
        },
      })
      .limit(limit)
      .exec();
  }

  async countByChannelId(channelId: string): Promise<number> {
    return this.videoModel
      .countDocuments({
        channelId: new Types.ObjectId(channelId),
        status: VideoStatus.PUBLISHED,
      })
      .exec();
  }
}
