import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Upload,
  UploadDocument,
  UploadStatus,
  UploadType,
} from './schemas/upload.schema';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(Upload.name) private uploadModel: Model<UploadDocument>,
  ) {}

  /**
   * Create upload record
   */
  async createUpload(
    userId: string,
    type: UploadType,
    originalFilename: string,
    fileSize: number,
  ) {
    const upload = await this.uploadModel.create({
      userId: new Types.ObjectId(userId),
      type,
      status: UploadStatus.UPLOADING,
      progress: 0,
      originalFilename,
      fileSize,
    });

    return {
      uploadId: upload._id.toString(),
      status: upload.status,
      progress: upload.progress,
    };
  }

  /**
   * Update upload progress
   */
  async updateProgress(uploadId: string, progress: number): Promise<void> {
    await this.uploadModel.findByIdAndUpdate(uploadId, { progress }).exec();
  }

  /**
   * Complete upload
   */
  async completeUpload(uploadId: string, fileUrl: string) {
    const upload = await this.uploadModel
      .findByIdAndUpdate(
        uploadId,
        {
          status: UploadStatus.COMPLETE,
          progress: 100,
          fileUrl,
        },
        { new: true },
      )
      .exec();

    return {
      uploadId: upload?._id.toString(),
      status: upload?.status,
      progress: 100,
      fileUrl,
    };
  }

  /**
   * Mark upload as processing
   */
  async markProcessing(uploadId: string): Promise<void> {
    await this.uploadModel
      .findByIdAndUpdate(uploadId, {
        status: UploadStatus.PROCESSING,
      })
      .exec();
  }

  /**
   * Fail upload
   */
  async failUpload(uploadId: string, error: string): Promise<void> {
    await this.uploadModel
      .findByIdAndUpdate(uploadId, {
        status: UploadStatus.FAILED,
        error,
      })
      .exec();
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string, userId: string) {
    const upload = await this.uploadModel
      .findOne({
        _id: new Types.ObjectId(uploadId),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!upload) {
      return null;
    }

    return {
      uploadId: upload._id.toString(),
      status: upload.status,
      progress: upload.progress,
      fileUrl: upload.fileUrl,
      error: upload.error,
    };
  }

  /**
   * Handle file upload (simple local storage for now)
   */
  async handleFileUpload(userId: string, file: MulterFile, type: UploadType) {
    const upload = await this.createUpload(
      userId,
      type,
      file.originalname,
      file.size,
    );

    // For local storage, file is already saved by multer
    const fileUrl = `/uploads/${type}s/${file.filename}`;

    return this.completeUpload(upload.uploadId, fileUrl);
  }
}
