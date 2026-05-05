/**
 * Test helper types and utilities for SchoolOS E2E tests
 */

export interface MockState {
  tenants: Record<string, unknown>[];
  permissions: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  rolePermissions: Record<string, unknown>[];
  users: Record<string, unknown>[];
  userRoles: Record<string, unknown>[];
  classes: Record<string, unknown>[];
  students: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  staffLeaveBalances: Record<string, unknown>[];
  academicYears: Record<string, unknown>[];
  chartAccounts: Record<string, unknown>[];
  feeHeads: Record<string, unknown>[];
  otpCodes: Record<string, unknown>[];
  refreshTokens: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  [key: string]: Record<string, unknown>[];
}

export interface PrismaMock {
  __state: MockState;
  [key: string]: unknown;
}

export interface RequestMock {
  ip: string;
  headers: Record<string, string>;
}

export interface ResponseMock {
  cookieCalls: { name: string; value: string }[];
  clearedCookies: string[];
  cookie(name: string, value: string): void;
  clearCookie(name: string): void;
}

export function createRequestMock(): RequestMock {
  return {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'jest',
    },
  };
}

export function createResponseMock(): ResponseMock & unknown {
  return {
    cookieCalls: [] as { name: string; value: string }[],
    clearedCookies: [] as string[],
    cookie(name: string, value: string) {
      this.cookieCalls.push({ name, value });
    },
    clearCookie(name: string) {
      this.clearedCookies.push(name);
    },
  } as unknown;
}

export function buildCookieHeader(
  cookies: { name: string; value: string }[],
  name: string,
): string | undefined {
  const cookie = cookies.find((item) => item.name === name);

  return cookie ? `${cookie.name}=${cookie.value}` : undefined;
}

export function createQueueMock(): Record<string, unknown> {
  return {
    add: jest.fn(async () => ({ id: 'job-1' })),
    close: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

export function applyMockUpdate(
  target: Record<string, unknown>,
  update: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(update)) {
    if (
      value &&
      typeof value === 'object' &&
      'increment' in value &&
      typeof value.increment !== 'undefined'
    ) {
      target[key] = Number(target[key] ?? 0) + Number(value.increment);
      continue;
    }

    target[key] = value;
  }
}
