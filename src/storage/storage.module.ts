import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StorageService } from './storage.service';
import { join } from 'path';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'STORAGE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'storage',
          protoPath: join(__dirname, 'storage.proto'),
          url: process.env.STORAGE_SERVICE_URL || 'localhost:50051',
          loader: {
            keepCase: true,
          },
          maxSendMessageLength: 1024 * 1024 * 1024,
          maxReceiveMessageLength: 1024 * 1024 * 1024,
        },
      },
    ]),
  ],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
