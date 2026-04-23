// config.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

@Module({})
export class ConfigModule {
  static forRoot({ isGlobal }: { isGlobal: boolean }): DynamicModule {
    return {
      module: ConfigModule,
      global: isGlobal,
      imports: [NestConfigModule.forRoot({ isGlobal: true })], // ← loads .env, provides NestConfigService
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}
