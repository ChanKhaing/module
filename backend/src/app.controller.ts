import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common';

@ApiTags('root')
@Controller()
export class AppController {
  @Public()
  @Get()
  welcome() {
    return {
      name: 'Ticket Platform API',
      version: '1.0.0',
      status: 'running',
      docs: '/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };
  }
}
