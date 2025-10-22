import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Channel, ChannelDocument } from './schemas/channel.schema';

@Injectable()
export class ChannelsRepository {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
  ) {}

  async create(channelData: Partial<Channel>): Promise<ChannelDocument> {
    const channel = new this.channelModel(channelData);
    return channel.save();
  }

  async findById(id: string): Promise<ChannelDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.channelModel.findById(id).exec();
  }

  async findByHandle(handle: string): Promise<ChannelDocument | null> {
    return this.channelModel.findOne({ handle: handle.toLowerCase() }).exec();
  }

  async findByUserId(userId: string): Promise<ChannelDocument | null> {
    // Query both as ObjectId and string to match any storage format or casting behavior
    return this.channelModel
      .findOne({
        userId: Types.ObjectId.isValid(userId)
          ? { $in: [new Types.ObjectId(userId), userId] }
          : userId,
      })
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Channel>,
  ): Promise<ChannelDocument | null> {
    return this.channelModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async updateByUserId(
    userId: string,
    updateData: Partial<Channel>,
  ): Promise<ChannelDocument | null> {
    return this.channelModel
      .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, updateData, {
        new: true,
      })
      .exec();
  }

  async incrementSubscribers(channelId: string, amount: number): Promise<void> {
    await this.channelModel
      .findByIdAndUpdate(channelId, {
        $inc: { subscriberCount: amount },
      })
      .exec();
  }

  async incrementVideoCount(channelId: string, amount: number): Promise<void> {
    await this.channelModel
      .findByIdAndUpdate(channelId, {
        $inc: { videoCount: amount },
      })
      .exec();
  }

  async incrementViews(channelId: string, amount: number): Promise<void> {
    await this.channelModel
      .findByIdAndUpdate(channelId, {
        $inc: { totalViews: amount },
      })
      .exec();
  }

  async search(query: string, limit: number = 10): Promise<ChannelDocument[]> {
    return this.channelModel
      .find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { handle: { $regex: query, $options: 'i' } },
        ],
      })
      .limit(limit)
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.channelModel.findByIdAndDelete(id).exec();
    return !!result;
  }
}
