import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../users/users.repository';

interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersRepository.findOne({ _id: payload.sub });
    if (!user) {
      throw new UnauthorizedException();
    }

    // Return full user object but stripped of password
    // matching SanitizedUser interface + userId for compatibility
    return {
      _id: user._id,
      userId: user._id.toString(), // For compatibility with controllers using .userId
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      streamKey: user.streamKey,
      createdAt: user.createdAt,
    };
  }
}
