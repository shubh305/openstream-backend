import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'johndoe', description: 'User username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'User email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SignupDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'New username (3-30 chars, alphanumeric + underscore)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'securePass1!',
    description: 'New password (min 8 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token' })
  access_token!: string;

  @ApiProperty({ description: 'Stream Key for RTMP' })
  streamKey!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Username to reset password for',
  })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'john@newemail.com',
    description: 'New email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    description: 'New avatar URL',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UserProfileDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ example: 'johndoe', description: 'User username' })
  username!: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  email!: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: 'User avatar URL',
    required: false,
    nullable: true,
  })
  avatar!: string | null;

  @ApiProperty({ example: 'sk_12345', description: 'User stream key' })
  streamKey!: string;

  @ApiProperty({ description: 'When user account was created' })
  createdAt!: Date;
}
