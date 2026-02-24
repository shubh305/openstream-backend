import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { CommentLike, CommentLikeSchema } from './schemas/comment-like.schema';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module'; // Assuming this import path

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: CommentLike.name, schema: CommentLikeSchema },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => AnalyticsModule),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
