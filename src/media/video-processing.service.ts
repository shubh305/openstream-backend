import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from './schemas/vod.schema';

import { StorageService } from '../storage/storage.service';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly vodPath = path.join(__dirname, '../../vod'); // Absolute path is safer

  constructor(
    @InjectModel(Vod.name) private vodModel: Model<VodDocument>,
    private readonly storageService: StorageService,
  ) {
    this.ensureVodDirectory();
  }

  private ensureVodDirectory() {
    if (!fs.existsSync(this.vodPath)) {
      fs.mkdirSync(this.vodPath, { recursive: true });
    }
  }

  async processAndSaveVideo(streamKey: string, flvPath: string) {
    this.logger.log(`Starting VOD processing for stream: ${streamKey}`);

    const timestamp = Date.now();
    const mp4Filename = `${streamKey}-${timestamp}.mp4`;
    const mp4Path = path.join(this.vodPath, mp4Filename);
    const thumbnailFilename = `${streamKey}-${timestamp}.jpg`;
    const thumbnailPath = path.join(this.vodPath, thumbnailFilename);

    let finalMp4Path = `/vods/${mp4Filename}`;
    let finalThumbnailPath = `/vods/${thumbnailFilename}`;
    const duration = 0;

    if (!fs.existsSync(flvPath)) {
      this.logger.warn(
        `FLV file not found at ${flvPath}. Using placeholder for VOD.`,
      );
      // Fallback: Skip FFmpeg, use placeholders
      finalMp4Path =
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      finalThumbnailPath =
        'https://placehold.co/640x360.png?text=Processing+Error';
    } else {
      // 1. Remux FLV to MP4 (Faststart for web playback)
      try {
        await this.runFFmpeg([
          '-i',
          flvPath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          mp4Path,
        ]);
        this.logger.log(`Generated VOD: ${mp4Path}`);

        // 2. Generate Thumbnail (Take frame at 5s or start)
        await this.runFFmpeg([
          '-i',
          mp4Path,
          '-ss',
          '00:00:05',
          '-vframes',
          '1',
          thumbnailPath,
        ]);
        this.logger.log(`Generated Thumbnail: ${thumbnailPath}`);

        // 3. Upload Thumbnail to Storage Service (MinIO)
        try {
          const thumbnailBuffer = fs.readFileSync(thumbnailPath);
          const uploadedUrl = await this.storageService.uploadImage(
            thumbnailFilename,
            thumbnailBuffer,
            'vods',
            'image/jpeg',
          );
          finalThumbnailPath = uploadedUrl;
          this.logger.log(`Uploaded Thumbnail to Cloud: ${finalThumbnailPath}`);

          if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
          }
        } catch (uploadErr) {
          const params =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          this.logger.error(`Failed to upload thumbnail: ${params}`);
        }

        // Cleanup local FLV
        if (fs.existsSync(flvPath)) {
          fs.unlinkSync(flvPath);
          this.logger.log(`Cleaned up raw FLV: ${flvPath}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(
          `Error generating VOD/Thumbnail for ${streamKey}: ${message}`,
        );
        return;
      }
    }

    // 3. Save Metadata to DB (Happens for both Real and Placeholder)
    await this.vodModel.create({
      filename: mp4Filename,
      path: finalMp4Path,
      thumbnail: finalThumbnailPath,
      duration: duration,
      createdAt: new Date(),
    });
    this.logger.log('Saved VOD metadata to MongoDB');
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use system ffmpeg path or configured one
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const proc = spawn(ffmpegPath, args);

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
  }
}
