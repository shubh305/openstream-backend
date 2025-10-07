import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { UsersRepository } from '../users/users.repository';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto } from './dto/auth.dto';

export interface SanitizedUser {
  _id: any;
  username: string;
  email: string;
  avatar?: string;
  streamKey: string;
  createdAt: Date;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async onModuleInit() {
    const demoUser = await this.usersRepository.findByUsername('demo');
    const hashedPassword = await bcrypt.hash('password', 10);

    if (!demoUser) {
      this.logger.log('Seeding database with default user: demo/password');
      await this.usersRepository.create({
        username: 'demo',
        email: 'demo@example.com',
        password: hashedPassword,
        streamKey: 'initial_key',
      });
    } else {
      demoUser.password = hashedPassword;
      if (!demoUser.email) {
        demoUser.email = 'demo@example.com';
      }
      await this.usersRepository.update(demoUser);
      this.logger.log('Updated demo user password and email.');
    }
  }

  async validateUser(
    username: string,
    pass: string,
  ): Promise<SanitizedUser | null> {
    const user = await this.usersRepository.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const userObj = user.toObject() as { [key: string]: any };
      delete userObj.password;
      return userObj as SanitizedUser;
    }
    return null;
  }

  login(user: SanitizedUser): AuthResponseDto {
    const payload = { username: user.username, sub: user._id as string };
    return {
      access_token: this.jwtService.sign(payload),
      streamKey: user.streamKey,
    };
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
}
