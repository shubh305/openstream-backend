import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

import { Observable } from 'rxjs';

interface StorageGrpcService {
  upload(data: {
    filename: string;
    data: Uint8Array | Buffer;
    bucket: string;
    mimeType: string;
  }): Observable<{ url: string }>;

  getPresignedUrl(data: {
    bucket: string;
    key: string;
    expiry?: number;
  }): Observable<{ url: string }>;

  delete(data: {
    bucket: string;
    key: string;
    isFolder: boolean;
  }): Observable<{ success: boolean; deletedCount: number }>;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private storageGrpcService: StorageGrpcService;
  private readonly logger = new Logger(StorageService.name);

  constructor(@Inject('STORAGE_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.storageGrpcService =
      this.client.getService<StorageGrpcService>('StorageService');
  }

  async upload(
    filename: string,
    buffer: Buffer,
    bucket: string = 'images',
    mimeType: string = 'image/jpeg',
  ): Promise<string> {
    try {
      this.logger.log(`Uploading ${filename} to bucket ${bucket} via gRPC...`);
      const response = await lastValueFrom<{ url: string }>(
        this.storageGrpcService.upload({
          filename,
          data: buffer,
          bucket,
          mimeType,
        }),
      );
      this.logger.log(`Upload successful (key): ${response.url}`);
      return response.url;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload file via gRPC: ${msg}`);
      throw error;
    }
  }

  async getPresignedUrl(bucket: string, key: string): Promise<string> {
    if (!key) return '';
    // If it's already a full URL (legacy data), return as is
    if (key.startsWith('http')) return key;

    try {
      const response = await lastValueFrom<{ url: string }>(
        this.storageGrpcService.getPresignedUrl({
          bucket,
          key,
          expiry: 3600, // 1 hour
        }),
      );
      return response.url;
    } catch (error) {
      this.logger.warn(`Failed to sign URL for ${key}: ${error}`);
      return '';
    }
  }

  async delete(
    bucket: string,
    key: string,
    isFolder: boolean = false,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Deleting ${isFolder ? 'folder' : 'file'} ${key} from bucket ${bucket} via gRPC...`,
      );
      const response = await lastValueFrom<{
        success: boolean;
        deletedCount: number;
      }>(
        this.storageGrpcService.delete({
          bucket,
          key,
          isFolder,
        }),
      );
      this.logger.log(
        `Delete successful. Objects removed: ${response.deletedCount}`,
      );
      return response.success;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete objects via gRPC: ${msg}`);
      return false;
    }
  }
}
