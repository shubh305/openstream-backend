import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// Request DTOs
export class CreateCommentDto {
  @ApiProperty({ example: 'Great video!', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  text: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  text: string;
}

export class CommentQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['newest', 'oldest', 'top'], default: 'newest' })
  @IsOptional()
  @IsString()
  sort?: 'newest' | 'oldest' | 'top' = 'newest';
}

// Response DTOs
export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user: string;

  @ApiProperty()
  avatarUrl: string;

  @ApiProperty()
  text: string;

  @ApiProperty({ example: '2 days ago' })
  timestamp: string;

  @ApiProperty()
  likes: number;

  @ApiProperty()
  replyCount: number;

  @ApiProperty()
  isOwner: boolean;

  @ApiProperty()
  userLiked: boolean;
}

export class PaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  hasMore: boolean;
}

export class CommentsListResponseDto {
  @ApiProperty({ type: [CommentResponseDto] })
  comments: CommentResponseDto[];

  @ApiProperty()
  commentCount: number;

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
