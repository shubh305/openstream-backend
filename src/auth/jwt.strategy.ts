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

    return {
      _id: user._id,
      userId: user._id.toString(),
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      streamKey: user.streamKey,
      createdAt: user.createdAt,
    };
  }
}
