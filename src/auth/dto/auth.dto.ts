import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'johndoe', description: 'User username' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SignupDto {
  @ApiProperty({ example: 'johndoe', description: 'New username' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'securePass1!', description: 'New password' })
  @IsString()
  @IsNotEmpty()
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

export class UserProfileDto {
  @ApiProperty({ example: 'johndoe', description: 'User username' })
  username!: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  email!: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: 'User avatar URL',
    required: false,
  })
  avatar?: string;

  @ApiProperty({ example: 'sk_12345', description: 'User stream key' })
  streamKey!: string;
}
