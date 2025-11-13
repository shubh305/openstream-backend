import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): { status: string; bridge: string; timestamp: string } {
    return {
      status: 'ok',
      bridge: 'verified',
      timestamp: new Date().toISOString(),
    };
  }
}
