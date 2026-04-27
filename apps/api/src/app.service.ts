import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getInfo() {
    return {
      service: 'schoolos-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };
    const ready = Object.values(checks).every((check) => check.status === 'ok');

    return {
      status: ready ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch (error) {
      return {
        status: 'error' as const,
        message:
          error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis() {
    try {
      const response = await this.redis.ping();
      return {
        status: response === 'PONG' ? ('ok' as const) : ('error' as const),
      };
    } catch (error) {
      return {
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }
}
