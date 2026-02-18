import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UsersRepository } from '../users/users.repository';
import { ChannelsService } from '../channels/channels.service';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto, UpdateProfileDto } from './dto/auth.dto';
import { Types } from 'mongoose';

export interface SanitizedUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  avatar?: string;
  banner?: string;
  streamKey: string;
  createdAt: Date;
}

interface JwtPayload {
  username: string;
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    @Inject(forwardRef(() => ChannelsService))
    private readonly channelsService: ChannelsService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const demoUser = await this.usersRepository.findByUsername('demo');
    const hashedPassword = await bcrypt.hash('password', 10);

    if (!demoUser) {
      this.logger.log('Seeding database with default user: demo/password');
      const newUser = await this.usersRepository.create({
        username: 'demo',
        email: 'demo@example.com',
        password: hashedPassword,
        streamKey: 'initial_key',
      });

      // Create channel for demo user
      try {
        await this.channelsService.createChannelForUser(
          newUser._id.toString(),
          newUser.username,
        );
        this.logger.log('Created channel for demo user');
      } catch {
        this.logger.log('Demo channel already exists or creation skipped');
      }
    } else {
      demoUser.password = hashedPassword;
      if (!demoUser.email) {
        demoUser.email = 'demo@example.com';
      }
      await this.usersRepository.update(demoUser);
      this.logger.log('Updated demo user password and email.');

      // Ensure demo user has a channel (skip if already exists)
      try {
        await this.channelsService.createChannelForUser(
          demoUser._id.toString(),
          demoUser.username,
        );
      } catch {
        // Channel already exists, which is fine
        this.logger.log('Demo channel already exists');
      }
    }
  }

  async validateUser(
    identifier: string,
    pass: string,
  ): Promise<SanitizedUser | null> {
    let user = await this.usersRepository.findByUsername(identifier);
    if (!user) {
      user = await this.usersRepository.findByEmail(identifier);
    }
    if (user && (await bcrypt.compare(pass, user.password))) {
      const userObj = user.toObject() as Record<string, unknown>;
      delete userObj.password;
      return userObj as unknown as SanitizedUser;
    }
    return null;
  }

  login(user: SanitizedUser): AuthResponseDto {
    const payload = { username: user.username, sub: user._id.toString() };
    const refreshExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: refreshExpiry as unknown as number,
      }),
      streamKey: user.streamKey,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload: JwtPayload = this.jwtService.verify(refreshToken);
      const userId = payload.sub;
      const user = await this.usersRepository.findOne({ _id: userId });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const sanitizedUser: SanitizedUser = {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        streamKey: user.streamKey,
        createdAt: user.createdAt,
      };

      return this.login(sanitizedUser);
    } catch (e: unknown) {
      this.logger.error(
        'Invalid refresh token',
        e instanceof Error ? e.stack : String(e),
      );
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async signup(
    username: string,
    email: string,
    pass: string,
  ): Promise<AuthResponseDto> {
    const existing = await this.usersRepository.findByUsername(username);
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }
    const hashedPassword = await bcrypt.hash(pass, 10);
    const streamKey = this.generateStreamKey();
    const user = await this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      streamKey,
    });

    // Auto-create channel for new user
    await this.channelsService.createChannelForUser(
      user._id.toString(),
      username,
    );
    this.logger.log(`Created channel for new user: ${username}`);

    const sanitizedUser: SanitizedUser = {
      _id: user._id,
      username: user.username,
      email: user.email,
      streamKey: user.streamKey,
      createdAt: user.createdAt,
    };

    return this.login(sanitizedUser);
  }

  async forgotPassword(username: string): Promise<string> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // TODO: Integrate Email Service
    this.logger.log(`Password reset requested for ${username}.`);
    return 'Password reset link sent to registered email.';
  }

  generateStreamKey(): string {
    return randomBytes(16).toString('hex');
  }

  async validateStreamKey(streamKey: string): Promise<boolean> {
    const user = await this.usersRepository.findByStreamKey(streamKey);
    return !!user;
  }

  async regenerateStreamKey(username: string): Promise<string> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    user.streamKey = this.generateStreamKey();
    await this.usersRepository.update(user);
    return user.streamKey;
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<SanitizedUser> {
    const user = await this.usersRepository.findOne({ _id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (updateDto.email) {
      user.email = updateDto.email;
    }
    if (updateDto.avatar) {
      user.avatar = updateDto.avatar;
    }

    await this.usersRepository.update(user);

    return {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      streamKey: user.streamKey,
      createdAt: user.createdAt,
    };
  }
}
