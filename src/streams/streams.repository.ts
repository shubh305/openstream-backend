import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Stream,
  StreamDocument,
  StreamStatus,
  StreamVisibility,
} from './schemas/stream.schema';

@Injectable()
export class StreamsRepository {
  constructor(
    @InjectModel(Stream.name) private streamModel: Model<StreamDocument>,
  ) {}

  async create(streamData: Partial<Stream>): Promise<StreamDocument> {
    const stream = new this.streamModel(streamData);
    return stream.save();
  }

  async findById(id: string): Promise<StreamDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.streamModel.findById(id).exec();
  }

  async findByUserId(userId: string): Promise<StreamDocument | null> {
    return this.streamModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveByUserId(userId: string): Promise<StreamDocument | null> {
    return this.streamModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: [StreamStatus.LIVE, StreamStatus.STARTING] },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findLiveStreams(limit: number = 20): Promise<StreamDocument[]> {
    return this.streamModel
      .find({
        status: StreamStatus.LIVE,
        visibility: StreamVisibility.PUBLIC,
      })
      .sort({ startedAt: -1, viewerCount: -1 })
      .limit(limit)
      .exec();
  }

  async findAllActive(): Promise<StreamDocument[]> {
    return this.streamModel
      .find({
        status: StreamStatus.LIVE,
        visibility: StreamVisibility.PUBLIC,
      })
      .sort({ startedAt: -1, viewerCount: -1 })
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<Stream>,
  ): Promise<StreamDocument | null> {
    return this.streamModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }
  async updateByUserId(
    userId: string,
    updateData: Partial<Stream>,
  ): Promise<StreamDocument | null> {
    const latest = await this.findByUserId(userId);
    if (!latest) return null;
    return this.streamModel
      .findByIdAndUpdate(latest._id, updateData, { new: true })
      .exec();
  }

  async setStatus(
    userId: string,
    status: StreamStatus,
  ): Promise<StreamDocument | null> {
    const updateData: Partial<Stream> = { status };

    if (status === StreamStatus.LIVE) {
      updateData.startedAt = new Date();
    } else if (status === StreamStatus.OFFLINE) {
      updateData.endedAt = new Date();
      updateData.viewerCount = 0;
    }

    return this.streamModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          status: { $ne: StreamStatus.OFFLINE },
        },
        updateData,
        {
          new: true,
          sort: { createdAt: -1 },
        },
      )
      .exec();
  }

  async setStatusWithStreamKey(
    userId: string,
    status: StreamStatus,
    streamKey: string | null,
  ): Promise<StreamDocument | null> {
    const updateData: Partial<Stream> = { status, streamKey };

    if (status === StreamStatus.LIVE) {
      updateData.startedAt = new Date();
    } else if (status === StreamStatus.OFFLINE) {
      updateData.endedAt = new Date();
      updateData.viewerCount = 0;
    }

    return this.streamModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          status: { $ne: StreamStatus.OFFLINE },
        },
        updateData,
        {
          new: true,
          sort: { createdAt: -1 },
        },
      )
      .exec();
  }

  async incrementViewers(id: string, amount: number): Promise<void> {
    await this.streamModel
      .findByIdAndUpdate(id, {
        $inc: { viewerCount: amount },
      })
      .exec();
  }

  async updatePeakViewers(id: string, count: number): Promise<void> {
    await this.streamModel
      .findByIdAndUpdate(id, {
        $max: { peakViewerCount: count },
      })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.streamModel.findByIdAndDelete(id).exec();
    return !!result;
  }
}
