import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthWebhookDto {
  @ApiProperty({ description: 'Stream Key', example: 'sk_12345' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'IP Address of publisher',
    example: '127.0.0.1',
    required: false,
  })
  @IsString()
  @IsOptional()
  addr?: string;
}

export class ProcessWebhookDto {
  @ApiProperty({
    description: 'Host filesystem path to recording',
    example: '/mnt/data/recordings/sk_12345.flv',
  })
  @IsString()
  @IsNotEmpty()
  path: string;
}
