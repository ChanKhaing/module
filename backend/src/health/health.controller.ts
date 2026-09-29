import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { SkipWrap } from '../common';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  /**
   * GET /health
   * → 200 { status: "ok", info: { mongodb: { status: "up" } }, ... }
   * → 503 DB သေရင်
   */
  @Get()
  @SkipWrap()                        // ← wrap မလုပ် (monitoring tool raw လိုတယ်)
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb', { timeout: 3000 }),
    ]);
  }

  /**
   * GET /health/live
   * → Kubernetes liveness probe
   * → Server process ရှင်လား (DB မပါ)
   */

    @Get('info')
  @SkipWrap()
  info() {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
      env: process.env.NODE_ENV ?? 'development',
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      },
    };
  }


  @Get('live')
  @SkipWrap()
  live() {
    return { status: 'ok' };
  }

  /**
   * GET /health/ready
   * → Kubernetes readiness probe
   * → Traffic လက်ခံဖို့ အသင့်လား (DB ပါ)
   */
  @Get('ready')
  @SkipWrap()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb', { timeout: 3000 }),
    ]);
  }
}