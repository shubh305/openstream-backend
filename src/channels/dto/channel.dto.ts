import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SocialLinksDto {
  @ApiPropertyOptional({ example: 'https://twitter.com/username' })
  @IsOptional()
  @IsString()
  twitter?: string | null;

  @ApiPropertyOptional({ example: 'https://instagram.com/username' })
  @IsOptional()
  @IsString()
  instagram?: string | null;

  @ApiPropertyOptional({ example: 'https://discord.gg/invite' })
  @IsOptional()
  @IsString()
  discord?: string | null;
}

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: 'My Awesome Channel', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    example: 'my_channel',
    maxLength: 30,
    description: 'Alphanumeric and underscores only',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Handle can only contain letters, numbers, and underscores',
  })
  handle?: string;

  @ApiPropertyOptional({
    example: 'Welcome to my channel! I create amazing content.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  location?: string | null;

  @ApiPropertyOptional({ example: 'contact@example.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @ApiPropertyOptional({ type: SocialLinksDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}

export class ChannelResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  userId: string;

  @ApiProperty({ example: 'My Awesome Channel' })
  name: string;

  @ApiProperty({ example: 'my_channel' })
  handle: string;

  @ApiProperty({ example: 'Welcome to my channel!' })
  description: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/banner.jpg' })
  bannerUrl: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/avatar.jpg' })
  avatarUrl: string;

  @ApiPropertyOptional({ example: 'San Francisco, CA' })
  location: string | null;

  @ApiPropertyOptional({ example: 'contact@example.com' })
  contactEmail: string | null;

  @ApiProperty({ type: SocialLinksDto })
  socialLinks: SocialLinksDto;

  @ApiProperty({ example: 15420 })
  subscriberCount: number;

  @ApiProperty({ example: 142 })
  videoCount: number;

  @ApiProperty({ example: '14,230,129' })
  totalViews: string;

  @ApiProperty({ example: 'Sep 12, 2015' })
  joinedDate: string;

  @ApiProperty({ example: false })
  isOwner: boolean;
}

export class ChannelStatsDto {
  @ApiProperty({ example: 15420 })
  subscriberCount: number;

  @ApiProperty({ example: 142 })
  videoCount: number;

  @ApiProperty({ example: 14230129 })
  totalViews: number;

  @ApiProperty({ example: 1250 })
  totalLikes: number;
}
