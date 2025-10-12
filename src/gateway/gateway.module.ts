import { Module } from '@nestjs/common';
import { StreamGateway } from './stream.gateway';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuthModule, ConfigModule],
  providers: [StreamGateway],
})
export class GatewayModule {}
