import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async findOne(filter: Record<string, any>): Promise<UserDocument | null> {
    return this.userModel.findOne(filter).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByStreamKey(streamKey: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ streamKey }).exec();
  }

  async update(user: UserDocument): Promise<UserDocument> {
    return user.save();
  }
}
