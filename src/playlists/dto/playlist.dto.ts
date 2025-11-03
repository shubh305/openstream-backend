import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlaylistVisibility } from '../schemas/playlist.schema';

export class CreatePlaylistDto {
  @ApiProperty({ example: 'My Awesome Playlist', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    example: 'Description of the playlist',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: PlaylistVisibility,
    default: PlaylistVisibility.PRIVATE,
  })
  @IsOptional()
  @IsEnum(PlaylistVisibility)
  visibility?: PlaylistVisibility;
}

export class UpdatePlaylistDto {
  @ApiPropertyOptional({ example: 'Updated Title', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PlaylistVisibility })
  @IsOptional()
  @IsEnum(PlaylistVisibility)
  visibility?: PlaylistVisibility;
}

export class AddVideoDto {
  @ApiProperty({ example: 'videoId_string' })
  @IsString()
  @IsNotEmpty()
  videoId: string;
}

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  videoId: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderVideosDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  videoOrder: OrderItemDto[];
}
