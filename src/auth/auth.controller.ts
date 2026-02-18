import {
  Controller,
  Post,
  Body,
  Put,
  UseGuards,
  Req,
  UnauthorizedException,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import {
  LoginDto,
  SignupDto,
  AuthResponseDto,
  ForgotPasswordDto,
  UserProfileDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import type { AuthRequest } from '../common/types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({
    status: 200,
    description: 'JWT Access Token generated',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const identifier = loginDto.username || loginDto.email;
    if (!identifier) {
      throw new UnauthorizedException('Username or Email is required');
    }
    const user = await this.authService.validateUser(
      identifier,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    if (!signupDto.username || !signupDto.password) {
      throw new UnauthorizedException('Username and password required');
    }
    return this.authService.signup(
      signupDto.username,
      signupDto.email,
      signupDto.password,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user (invalidate session)' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(): void {
    // In a stateless JWT setup, logout is handled client-side by removing the token
    // For stateful sessions, we would invalidate the token here
    return;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile returned',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Req() req: AuthRequest): UserProfileDto {
    const user = req.user;
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email || '',
      avatar: user.avatar || null,
      streamKey: user.streamKey || '',
      createdAt: user.createdAt || new Date(),
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard('jwt'))
  @Put('profile')
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() updateDto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updated = await this.authService.updateProfile(
      req.user._id.toString(),
      updateDto,
    );
    return {
      id: updated._id.toString(),
      username: updated.username,
      email: updated.email || '',
      avatar: updated.avatar || null,
      streamKey: updated.streamKey,
      createdAt: updated.createdAt || new Date(),
    };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'New access token',
    type: AuthResponseDto,
  })
  @Post('refresh')
  async refreshToken(
    @Body('refresh_token') refreshToken: string,
  ): Promise<AuthResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    return this.authService.refresh(refreshToken);
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent',
  })
  @Post('reset-password')
  async resetPassword(@Body() body: ForgotPasswordDto) {
    return { message: await this.authService.forgotPassword(body.username) };
  }

  @ApiOperation({ summary: 'Trigger password reset flow (legacy)' })
  @ApiResponse({
    status: 201,
    description: 'Password reset email sent (simulation)',
  })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return { message: await this.authService.forgotPassword(body.username) };
  }
}
