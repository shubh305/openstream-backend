import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsDate,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  VideoVisibility,
  VideoCategory,
  VideoStatus,
} from '../schemas/video.schema';

// Request DTOs
export class CreateVideoDto {
  @ApiProperty({ example: 'My Awesome Video', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    example: 'Check out this amazing content!',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    enum: VideoVisibility,
    default: VideoVisibility.PRIVATE,
  })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: VideoCategory, default: VideoCategory.OTHER })
  @IsOptional()
  @IsEnum(VideoCategory)
  category?: VideoCategory;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/thumb.jpg' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/video.mp4' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ enum: VideoStatus, default: VideoStatus.DRAFT })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;
}

export class UpdateVideoDto {
  @ApiPropertyOptional({ example: 'Updated Title', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: VideoCategory })
  @IsOptional()
  @IsEnum(VideoCategory)
  category?: VideoCategory;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/thumb.jpg' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ enum: VideoStatus })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  publishedAt?: Date;
}

export class VideoQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @ApiPropertyOptional({
    enum: ['latest', 'popular', 'oldest'],
    default: 'latest',
  })
  @IsOptional()
  @IsString()
  sort?: 'latest' | 'popular' | 'oldest' = 'latest';

  @ApiPropertyOptional({ enum: VideoCategory })
  @IsOptional()
  @IsEnum(VideoCategory)
  category?: VideoCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: VideoStatus })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: any }) => {
    if (value === undefined || value === null) return undefined;
    return value === 'true' || value === true;
  })
  isLive?: boolean;
}

// Response DTOs
export class CreatorDto {
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'https://cdn.example.com/avatar.jpg' })
  avatarUrl: string;

  @ApiPropertyOptional({ example: '1.2M' })
  subscribers?: string;

  @ApiPropertyOptional({ example: false })
  isVerified?: boolean;
}

export class VideoListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  thumbnailUrl: string;

  @ApiProperty({ example: '12:45' })
  duration: string;

  @ApiProperty()
  views: number;

  @ApiProperty({ example: '2 days ago' })
  uploadedAt: string;

  @ApiProperty()
  isLive: boolean;

  @ApiProperty({ enum: VideoVisibility })
  visibility: VideoVisibility;

  @ApiProperty()
  likes: number;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty({ type: CreatorDto })
  creator: CreatorDto;
}

export class PaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  hasMore: boolean;
}

export class VideoListResponseDto {
  @ApiProperty({ type: [VideoListItemDto] })
  videos: VideoListItemDto[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}

export class UserInteractionDto {
  @ApiProperty()
  liked: boolean;

  @ApiProperty()
  disliked: boolean;

  @ApiProperty()
  subscribed: boolean;
}

export class VideoDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  thumbnailUrl: string;

  @ApiProperty()
  posterUrl: string;

  @ApiProperty()
  videoUrl: string;

  @ApiProperty({ example: '12:45' })
  duration: string;

  @ApiProperty()
  views: number;

  @ApiProperty()
  likes: number;

  @ApiProperty()
  dislikes: number;

  @ApiProperty()
  commentsCount: number;

  @ApiProperty({ example: '2 days ago' })
  uploadedAt: string;

  @ApiProperty()
  publishedAt: string;

  @ApiProperty({ enum: VideoVisibility })
  visibility: VideoVisibility;

  @ApiProperty()
  isLive: boolean;

  @ApiProperty()
  category: string;

  @ApiProperty({ type: CreatorDto })
  creator: CreatorDto;

  @ApiProperty({ type: UserInteractionDto })
  userInteraction: UserInteractionDto;

  @ApiPropertyOptional({ type: [String], example: ['480p', '720p', '1080p'] })
  resolutions?: string[];
}
