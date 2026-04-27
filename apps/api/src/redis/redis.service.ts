import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  getClient() {
    if (!this.client) {
      this.client = new Redis({
        host: this.configService.redisHost,
        port: this.configService.redisPort,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });
    }

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
