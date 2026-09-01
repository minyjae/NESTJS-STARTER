import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  check() {
    return {
      status: 'ok',
      env: this.configService.get<string>('app.env'),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
