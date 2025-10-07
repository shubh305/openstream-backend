import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Get,
} from '@nestjs/common';
import { AuthService, SanitizedUser } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import {
  LoginDto,
  SignupDto,
  AuthResponseDto,
  ForgotPasswordDto,
  UserProfileDto,
} from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

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
    const user = await this.authService.validateUser(
      loginDto.username,
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

  @ApiOperation({ summary: 'Trigger password reset flow' })
  @ApiResponse({
    status: 201,
    description: 'Password reset email sent (simulation)',
    schema: { example: { message: 'Password reset link sent...' } },
  })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return { message: await this.authService.forgotPassword(body.username) };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (Protected)' })
  @ApiResponse({
    status: 200,
    description: 'User profile returned',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Req() req: { user: SanitizedUser }) {
    return req.user;
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate Stream Key (Protected)' })
  @ApiResponse({ status: 201, description: 'New Stream Key generated' })
  @UseGuards(AuthGuard('jwt'))
  @Post('regenerate-key')
  regenerateKey(@Req() req: { user: SanitizedUser }) {
    const user = req.user;
    return {
      streamKey: this.authService.regenerateStreamKey(user.username),
    };
  }
}
