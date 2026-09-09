import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  getClient() {
    this.client ??= new Redis({
      ...this.configService.redisConnectionOptions,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    return this.client;
  }

  async ping() {
    const client = this.getClient();

    if (client.status === 'wait') {
      await client.connect();
    }

    return client.ping();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
