import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { UploadType } from './schemas/upload.schema';

interface AuthRequest extends Request {
  user: {
    _id: { toString: () => string };
  };
}

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

@ApiTags('Upload')
@Controller('upload')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload video file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Video uploaded' })
  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@Req() req: AuthRequest, @UploadedFile() file: MulterFile) {
    return this.uploadService.handleFileUpload(
      req.user._id.toString(),
      file,
      UploadType.VIDEO,
    );
  }

  @ApiOperation({ summary: 'Upload thumbnail' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        videoId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Thumbnail uploaded' })
  @Post('thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
    @Req() req: AuthRequest,
    @UploadedFile() file: MulterFile,
  ) {
    return this.uploadService.handleFileUpload(
      req.user._id.toString(),
      file,
      UploadType.THUMBNAIL,
    );
  }

  @ApiOperation({ summary: 'Upload avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded' })
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Req() req: AuthRequest,
    @UploadedFile() file: MulterFile,
  ) {
    return this.uploadService.handleFileUpload(
      req.user._id.toString(),
      file,
      UploadType.AVATAR,
    );
  }

  @ApiOperation({ summary: 'Upload banner' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Banner uploaded' })
  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @Req() req: AuthRequest,
    @UploadedFile() file: MulterFile,
  ) {
    return this.uploadService.handleFileUpload(
      req.user._id.toString(),
      file,
      UploadType.BANNER,
    );
  }

  @ApiOperation({ summary: 'Get upload status' })
  @ApiResponse({ status: 200, description: 'Upload status' })
  @Get('status/:uploadId')
  async getUploadStatus(
    @Param('uploadId') uploadId: string,
    @Req() req: AuthRequest,
  ) {
    return this.uploadService.getUploadStatus(
      uploadId,
      req.user._id.toString(),
    );
  }
}
