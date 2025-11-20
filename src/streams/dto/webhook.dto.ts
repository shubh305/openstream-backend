import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import {
  StreamVisibility,
  LatencyMode,
  StreamCategory,
} from '../schemas/stream.schema';

// Existing webhook DTOs - keeping these for compatibility
export class AuthWebhookDto {
  @ApiProperty({ description: 'Stream key from RTMP' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  addr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  app?: string;

  @ApiPropertyOptional()
  @IsOptional()
  flashver?: string;

  @ApiPropertyOptional()
  @IsOptional()
  swfurl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  tcurl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  pageurl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  clientid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  call?: string;
}

export class ProcessWebhookDto {
  @ApiProperty({ description: 'Path to recorded file' })
  @IsString()
  path: string;

  @ApiPropertyOptional()
  @IsOptional()
  recorder?: string;
}

// New stream settings DTOs
export class UpdateStreamSettingsDto {
  @ApiPropertyOptional({ example: 'My Live Stream' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: StreamCategory })
  @IsOptional()
  @IsEnum(StreamCategory)
  category?: StreamCategory;

  @ApiPropertyOptional({ enum: StreamVisibility })
  @IsOptional()
  @IsEnum(StreamVisibility)
  visibility?: StreamVisibility;

  @ApiPropertyOptional({ enum: LatencyMode })
  @IsOptional()
  @IsEnum(LatencyMode)
  latencyMode?: LatencyMode;
}

export class CreatorDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  avatarUrl: string;
}

export class StreamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  visibility: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  thumbnailUrl: string | null;

  @ApiProperty()
  viewerCount: number;

  @ApiPropertyOptional()
  startedAt: string | null;

  @ApiProperty()
  latencyMode: string;

  @ApiPropertyOptional()
  hlsPlaybackUrl: string | null;

  @ApiProperty({ type: CreatorDto })
  creator: CreatorDto;
}

export class StreamKeyResponseDto {
  @ApiProperty({ example: 'sk_live_abc123def456' })
  streamKey: string;

  @ApiProperty({ example: 'rtmp://ingest.openstream.dev/live' })
  rtmpUrl: string;

  @ApiProperty({ example: 'wss://ingest.openstream.dev/ws/ingest' })
  wsUrl: string;
}

export class StreamListResponseDto {
  @ApiProperty({ type: [StreamResponseDto] })
  streams: StreamResponseDto[];

  @ApiProperty()
  total: number;
}
