import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ChannelsRepository } from './channels.repository';
import { UpdateChannelDto, ChannelResponseDto } from './dto/channel.dto';
import { ChannelDocument, Channel } from './schemas/channel.schema';
import { UsersRepository } from '../users/users.repository';

interface MongoError extends Error {
  code?: number;
}

@Injectable()
export class ChannelsService {
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Create a channel for a new user
   */
  async createChannelForUser(
    userId: string,
    username: string,
  ): Promise<ChannelDocument> {
    const existingChannel = await this.channelsRepository.findByUserId(userId);
    if (existingChannel) {
      return existingChannel;
    }

    try {
      return await this.channelsRepository.create({
        userId: new Types.ObjectId(userId) as unknown as Channel['userId'],
        name: username,
        handle: username.toLowerCase(),
        description: '',
        subscriberCount: 0,
        videoCount: 0,
        totalViews: 0,
      });
    } catch (err) {
      const error = err as MongoError;
      if (error.code === 11000) {
        const existing = await this.channelsRepository.findByUserId(userId);
        if (existing) return existing;

        throw new ConflictException(
          'Channel already exists but could not be retrieved',
        );
      }
      throw error;
    }
  }

  /**
   * Get channel by handle (public)
   */
  async getChannelByHandle(
    handle: string,
    currentUserId?: string,
  ): Promise<ChannelResponseDto> {
    const channel = await this.channelsRepository.findByHandle(handle);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const user = await this.usersRepository.findOne({
      _id: channel.userId,
    });

    return this.formatChannelResponse(
      channel,
      user?.avatar || null,
      currentUserId,
    );
  }

  /**
   * Get channel by user ID (for authenticated user)
   */
  async getMyChannel(userId: string): Promise<ChannelResponseDto> {
    let channel = await this.channelsRepository.findByUserId(userId);

    if (!channel) {
      const user = await this.usersRepository.findOne({ _id: userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      channel = await this.createChannelForUser(userId, user.username);
    }

    const user = await this.usersRepository.findOne({ _id: userId });

    return this.formatChannelResponse(channel, user?.avatar || null, userId);
  }

  /**
   * Update channel info
   */
  async updateChannel(
    userId: string,
    updateDto: UpdateChannelDto,
  ): Promise<ChannelResponseDto> {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (updateDto.handle) {
      const existing = await this.channelsRepository.findByHandle(
        updateDto.handle,
      );
      if (existing && existing._id.toString() !== channel._id.toString()) {
        throw new ConflictException('Handle is already taken');
      }
    }

    const updateData: Partial<Channel> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.handle !== undefined) updateData.handle = updateDto.handle;
    if (updateDto.description !== undefined)
      updateData.description = updateDto.description;
    if (updateDto.location !== undefined)
      updateData.location = updateDto.location;
    if (updateDto.contactEmail !== undefined)
      updateData.contactEmail = updateDto.contactEmail;
    if (updateDto.socialLinks !== undefined)
      updateData.socialLinks = {
        twitter: updateDto.socialLinks.twitter ?? null,
        instagram: updateDto.socialLinks.instagram ?? null,
        discord: updateDto.socialLinks.discord ?? null,
      };

    const updatedChannel = await this.channelsRepository.update(
      channel._id.toString(),
      updateData,
    );

    const user = await this.usersRepository.findOne({ _id: userId });

    return this.formatChannelResponse(
      updatedChannel!,
      user?.avatar || null,
      userId,
    );
  }

  /**
   * Update channel branding (banner and picture)
   */
  async updateBranding(
    userId: string,
    bannerUrl?: string,
    pictureUrl?: string,
  ): Promise<ChannelResponseDto> {
    const channel = await this.channelsRepository.findByUserId(userId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const updateData: Partial<Channel> = {};
    if (bannerUrl) {
      updateData.bannerUrl = bannerUrl;
    }

    if (pictureUrl) {
      const user = await this.usersRepository.findOne({ _id: userId });
      if (user) {
        user.avatar = pictureUrl;
        await user.save();
      }
    }

    const updatedChannel = await this.channelsRepository.updateByUserId(
      userId,
      updateData,
    );

    const user = await this.usersRepository.findOne({ _id: userId });

    return this.formatChannelResponse(
      updatedChannel || channel,
      user?.avatar || null,
      userId,
    );
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(handle: string) {
    const channel = await this.channelsRepository.findByHandle(handle);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return {
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
      totalViews: channel.totalViews,
      totalLikes: 0,
    };
  }

  /**
   * Format channel document to response DTO
   */
  private formatChannelResponse(
    channel: ChannelDocument,
    avatarUrl: string | null,
    currentUserId?: string,
  ): ChannelResponseDto {
    const isOwner = currentUserId
      ? channel.userId.toString() === currentUserId
      : false;

    return {
      id: channel._id.toString(),
      userId: channel.userId.toString(),
      name: channel.name,
      handle: channel.handle,
      description: channel.description,
      bannerUrl: channel.bannerUrl,
      avatarUrl: avatarUrl || '',
      location: channel.location,
      contactEmail: channel.contactEmail,
      socialLinks: channel.socialLinks || {
        twitter: null,
        instagram: null,
        discord: null,
      },
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
      totalViews: this.formatNumber(channel.totalViews),
      joinedDate: this.formatDate(channel.createdAt),
      isOwner,
    };
  }

  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
