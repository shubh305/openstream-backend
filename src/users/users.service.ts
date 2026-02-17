import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly storageService: StorageService,
  ) {}

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    const filename = `avatar-${user._id.toString()}-${Date.now()}.jpg`; // Normalizing to jpg or keep ext
    const key = await this.storageService.upload(
      filename,
      file.buffer,
      'avatars',
      file.mimetype,
    );

    user.avatar = key;
    await this.usersRepository.update(user);
    return this.storageService.getPresignedUrl('avatars', key);
  }

  async uploadBanner(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    const filename = `banner-${user._id.toString()}-${Date.now()}.jpg`;
    const key = await this.storageService.upload(
      filename,
      file.buffer,
      'banners',
      file.mimetype,
    );

    user.banner = key;
    const savedUser = await this.usersRepository.update(user);
    this.logger.log(`Updated user banner for ${userId}: ${savedUser.banner}`);
    return this.storageService.getPresignedUrl('banners', key);
  }
}
