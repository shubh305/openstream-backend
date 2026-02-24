import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import {
  CommentLike,
  CommentLikeDocument,
} from './schemas/comment-like.schema';
import { UsersRepository } from '../users/users.repository';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentQueryDto,
  CommentsListResponseDto,
  CommentResponseDto,
} from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(CommentLike.name)
    private commentLikeModel: Model<CommentLikeDocument>,
    private readonly usersRepository: UsersRepository,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Get total comments count for a video
   */
  async countByVideoId(videoId: string): Promise<number> {
    return this.commentModel
      .countDocuments({ videoId: new Types.ObjectId(videoId) })
      .exec();
  }

  /**
   * Get comments for a video
   */
  async getVideoComments(
    videoId: string,
    query: CommentQueryDto,
    userId?: string,
  ): Promise<CommentsListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Sort options
    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (query.sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (query.sort === 'top') {
      sortOption = { likes: -1 };
    }

    // Get top-level comments only (parentId is null)
    const filter = {
      videoId: new Types.ObjectId(videoId),
      parentId: null,
    };

    const [comments, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);

    const formattedComments = await Promise.all(
      comments.map((comment) => this.formatComment(comment, userId)),
    );

    return {
      comments: formattedComments,
      commentCount: total,
      pagination: {
        page,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Add a comment to a video
   */
  async addComment(
    videoId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = new this.commentModel({
      videoId: new Types.ObjectId(videoId),
      userId: new Types.ObjectId(userId),
      parentId: null,
      text: dto.text,
      likes: 0,
      replyCount: 0,
    });

    await comment.save();

    // Track analytics
    void this.analyticsService.trackEvent('comment', undefined, videoId, 1);

    return this.formatComment(comment, userId);
  }

  /**
   * Edit a comment
   */
  async editComment(
    id: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.text = dto.text;
    await comment.save();

    return this.formatComment(comment, userId);
  }

  /**
   * Delete a comment
   */
  async deleteComment(id: string, userId: string): Promise<void> {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Delete the comment and all its replies
    await this.commentModel
      .deleteMany({
        $or: [
          { _id: new Types.ObjectId(id) },
          { parentId: new Types.ObjectId(id) },
        ],
      })
      .exec();

    // If this was a reply, decrement parent's reply count
    if (comment.parentId) {
      await this.commentModel
        .findByIdAndUpdate(comment.parentId, {
          $inc: { replyCount: -1 },
        })
        .exec();
    }
  }

  /**
   * Like a comment
   */
  async likeComment(id: string, userId: string): Promise<void> {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existingLike = await this.commentLikeModel
      .findOne({
        commentId: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (existingLike) {
      return; // Already liked
    }

    await this.commentLikeModel.create({
      commentId: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    await this.commentModel
      .findByIdAndUpdate(id, {
        $inc: { likes: 1 },
      })
      .exec();
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(id: string, userId: string): Promise<void> {
    const result = await this.commentLikeModel
      .findOneAndDelete({
        commentId: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (result) {
      await this.commentModel
        .findByIdAndUpdate(id, {
          $inc: { likes: -1 },
        })
        .exec();
    }
  }

  /**
   * Get replies to a comment
   */
  async getReplies(
    commentId: string,
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): Promise<CommentsListResponseDto> {
    const skip = (page - 1) * limit;

    const filter = { parentId: new Types.ObjectId(commentId) };

    const [replies, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);

    const formattedReplies = await Promise.all(
      replies.map((reply) => this.formatComment(reply, userId)),
    );

    return {
      comments: formattedReplies,
      commentCount: total,
      pagination: {
        page,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Reply to a comment
   */
  async replyToComment(
    parentId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const parentComment = await this.commentModel.findById(parentId).exec();
    if (!parentComment) {
      throw new NotFoundException('Parent comment not found');
    }

    const reply = new this.commentModel({
      videoId: parentComment.videoId,
      userId: new Types.ObjectId(userId),
      parentId: new Types.ObjectId(parentId),
      text: dto.text,
      likes: 0,
      replyCount: 0,
    });

    await reply.save();

    // Increment parent's reply count
    await this.commentModel
      .findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      })
      .exec();

    return this.formatComment(reply, userId);
  }

  /**
   * Format comment document to response DTO
   */
  private async formatComment(
    comment: CommentDocument,
    currentUserId?: string,
  ): Promise<CommentResponseDto> {
    const user = await this.usersRepository.findOne({
      _id: comment.userId.toString(),
    });

    let userLiked = false;
    if (currentUserId) {
      const like = await this.commentLikeModel
        .findOne({
          commentId: comment._id,
          userId: new Types.ObjectId(currentUserId),
        })
        .exec();
      userLiked = !!like;
    }

    return {
      id: comment._id.toString(),
      user: user?.username || 'Unknown',
      avatarUrl: user?.avatar || '',
      text: comment.text,
      timestamp: this.formatRelativeTime(comment.createdAt),
      likes: comment.likes,
      replyCount: comment.replyCount,
      isOwner: currentUserId
        ? comment.userId.toString() === currentUserId
        : false,
      userLiked,
    };
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000)
      return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }
}
