import { Module } from '@nestjs/common';
import { StreamGateway } from './stream.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [StreamGateway],
})
export class GatewayModule {}
