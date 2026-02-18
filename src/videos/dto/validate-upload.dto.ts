import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Maximum upload size from env or 5GB default */
const MAX_UPLOAD_BYTES = parseInt(
  process.env.MAX_UPLOAD_BYTES || '5368709120',
  10,
);

export class ValidateUploadDto {
  @ApiProperty({ description: 'Original filename', example: 'my-video.mp4' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File size in bytes', example: 104857600 })
  @IsNumber()
  @Max(MAX_UPLOAD_BYTES, {
    message: `File size exceeds maximum allowed (${MAX_UPLOAD_BYTES} bytes)`,
  })
  sizeBytes: number;

  @ApiProperty({
    description: 'MIME type reported by browser',
    example: 'video/mp4',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiPropertyOptional({
    description: 'Optional SHA-256 checksum for integrity verification',
    example: 'e3b0c44298fc1c149afbf4c8996fb924',
  })
  @IsString()
  @IsOptional()
  checksum?: string;
}

export class ValidateUploadResponseDto {
  @ApiProperty({ description: 'Server-issued upload session ID' })
  sessionId: string;

  @ApiProperty({ description: 'Internal Video ID (MongoDB ID)' })
  videoId: string;

  @ApiProperty({ description: 'TUS upload endpoint URL' })
  uploadUrl: string;
}
