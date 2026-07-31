import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ConfigService } from '../../config/config.service';
import { M1AdmissionsHardeningController } from '../../admissions/m1-admissions-hardening.controller';
import { StudentsController } from '../../students/students.controller';
import { AppThrottlerGuard } from './app-throttler.guard';

const throttlerOptions: ThrottlerModuleOptions = [
  {
    name: 'default',
    limit: 100,
    ttl: 60_000,
  },
];

function buildGuard(rateLimitEnabled = true) {
  const storage = {
    increment: jest.fn().mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60_000,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
  } as unknown as ThrottlerStorage;
  const config = {
    rateLimitEnabled,
    authRateLimitMax: 5,
    authRateLimitWindow: 60,
    qrRateLimitMax: 10,
    qrRateLimitWindow: 60,
    apiKeyRateLimitMax: 30,
    apiKeyRateLimitWindow: 60,
  } as ConfigService;
  const guard = new AppThrottlerGuard(
    throttlerOptions,
    storage,
    new Reflector(),
    config,
  );

  return { guard, increment: storage.increment as jest.Mock };
}

function contextFor(input: {
  path: string;
  handler?: (...args: never[]) => unknown;
  controller?: object;
  headers?: Record<string, string>;
}) {
  const response = { header: jest.fn() };
  const handler = input.handler ?? function handler() {};
  const controller = input.controller ?? class TestController {};

  return {
    context: {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '127.0.0.1',
          path: input.path,
          headers: input.headers ?? {},
        }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext,
    response,
  };
}

describe('AppThrottlerGuard', () => {
  it('bypasses storage only when rate limiting is explicitly disabled outside production', async () => {
    const { guard, increment } = buildGuard(false);
    const { context } = contextFor({ path: '/api/v1/auth/login' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(increment).not.toHaveBeenCalled();
  });

  it('applies the bounded authentication limit to auth routes', async () => {
    const { guard, increment } = buildGuard();
    await guard.onModuleInit();
    const { context } = contextFor({ path: '/api/v1/auth/login' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      5,
      60_000,
      'default',
    );
  });

  it('preserves the stricter guardian-administration route decorator', async () => {
    const { guard, increment } = buildGuard();
    await guard.onModuleInit();
    const { context } = contextFor({
      path: '/api/v1/students/student-1/guardians/guardian-1/access-actions',
      handler:
        StudentsController.prototype.performGuardianRecoveryAction as (
          ...args: never[]
        ) => unknown,
      controller: StudentsController,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      10,
      60_000,
      'default',
    );
  });

  it('preserves the M1 guardian-removal route decorator', async () => {
    const { guard, increment } = buildGuard();
    await guard.onModuleInit();
    const { context } = contextFor({
      path: '/api/v1/admissions/m1/students/student-1/guardians/guardian-1',
      handler:
        M1AdmissionsHardeningController.prototype.removeGuardianAccess as (
          ...args: never[]
        ) => unknown,
      controller: M1AdmissionsHardeningController,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(increment).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      10,
      60_000,
      'default',
    );
  });

  it.each([
    ['/api/v1/students/qr/resolve', {}, 10],
    ['/api/v1/platform/api-keys', {}, 30],
    ['/api/v1/platform/status', { 'x-api-key': 'present' }, 30],
  ])(
    'applies the sensitive limit for %s',
    async (path, headers, expectedLimit) => {
      const { guard, increment } = buildGuard();
      await guard.onModuleInit();
      const { context } = contextFor({ path, headers });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(increment).toHaveBeenCalledWith(
        expect.any(String),
        60_000,
        expectedLimit,
        60_000,
        'default',
      );
    },
  );
});
