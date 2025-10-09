import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vod, VodDocument } from './schemas/vod.schema';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly vodPath = path.join(__dirname, '../../vod'); // Absolute path is safer

  constructor(@InjectModel(Vod.name) private vodModel: Model<VodDocument>) {
    this.ensureVodDirectory();
  }

  private ensureVodDirectory() {
    if (!fs.existsSync(this.vodPath)) {
      fs.mkdirSync(this.vodPath, { recursive: true });
    }
  }

  async processAndSaveVideo(streamKey: string, flvPath: string) {
    this.logger.log(`Starting VOD processing for stream: ${streamKey}`);

    if (!fs.existsSync(flvPath)) {
      this.logger.error(`FLV file not found: ${flvPath}`);
      return;
    }

    const timestamp = Date.now();
    const mp4Filename = `${streamKey}-${timestamp}.mp4`;
    const mp4Path = path.join(this.vodPath, mp4Filename);
    const thumbnailFilename = `${streamKey}-${timestamp}.jpg`;
    const thumbnailPath = path.join(this.vodPath, thumbnailFilename);

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

      // 3. Save Metadata to DB
      await this.vodModel.create({
        filename: mp4Filename,
        path: `/vods/${mp4Filename}`,
        thumbnail: `/vods/${thumbnailFilename}`,
        duration: 0, // Placeholder, could analyze file to get duration
        createdAt: new Date(),
      });
      this.logger.log('Saved VOD metadata to MongoDB');

      // 4. Cleanup local FLV
      // fs.unlinkSync(flvPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Error generating thumbnail for ${streamKey}: ${message}`,
      );
    }
  }

  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use system ffmpeg path or configured one
      const ffmpegPath = '/opt/homebrew/bin/ffmpeg';
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
