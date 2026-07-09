import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { generateCsrfToken } from '../auth.utils';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const jwtSecret = 'csrf-test-secret';

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'allows safe %s requests without a CSRF token',
    (method) => {
      const guard = createGuard({ isProduction: false });

      expect(guard.canActivate(createContext({ method }))).toBe(true);
    },
  );

  it('allows bearer-token API clients to mutate without browser CSRF cookies', () => {
    const guard = createGuard({ isProduction: false });

    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          headers: { authorization: 'Bearer api-client-token' },
        }),
      ),
    ).toBe(true);
  });

  it('allows public auth and tenant registration routes without CSRF cookies', () => {
    const guard = createGuard({ isProduction: false });

    expect(
      guard.canActivate(
        createContext({ method: 'POST', path: '/api/v1/auth/login' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          path: '/api/v1/auth/forgot-password',
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          path: '/api/v1/auth/reset-password',
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({ method: 'POST', path: '/api/v1/tenants/register' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({ method: 'POST', path: '/api/v1/demo-requests' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          path: '/api/v1/payments/online/webhook/esewa',
        }),
      ),
    ).toBe(true);
  });

  it('requires the development CSRF cookie and matching header for browser mutations', () => {
    const guard = createGuard({ isProduction: false });

    expect(() => guard.canActivate(createContext({ method: 'POST' }))).toThrow(
      new ForbiddenException('CSRF cookie missing'),
    );

    const token = generateCsrfToken(jwtSecret);
    expect(() =>
      guard.canActivate(
        createContext({
          method: 'POST',
          headers: { cookie: `schoolos_csrf=${token}` },
        }),
      ),
    ).toThrow(new ForbiddenException('CSRF header missing'));

    expect(() =>
      guard.canActivate(
        createContext({
          method: 'POST',
          headers: {
            cookie: `schoolos_csrf=${token}`,
            'x-csrf-token': `${token}-tampered`,
          },
        }),
      ),
    ).toThrow(new ForbiddenException('CSRF token mismatch'));
  });

  it('rejects matching CSRF cookie/header pairs with invalid signatures', () => {
    const guard = createGuard({ isProduction: false });
    const invalidToken = 'csrf-value.invalid-signature';

    expect(() =>
      guard.canActivate(
        createContext({
          method: 'PATCH',
          headers: {
            cookie: `schoolos_csrf=${invalidToken}`,
            'x-csrf-token': invalidToken,
          },
        }),
      ),
    ).toThrow(new ForbiddenException('Invalid CSRF token signature'));
  });

  it('accepts signed development CSRF tokens for browser mutations', () => {
    const guard = createGuard({ isProduction: false });
    const token = generateCsrfToken(jwtSecret);

    expect(
      guard.canActivate(
        createContext({
          method: 'DELETE',
          headers: {
            cookie: `theme=dark; schoolos_csrf=${token}`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toBe(true);
  });

  it('uses the host-prefixed CSRF cookie name in production', () => {
    const guard = createGuard({ isProduction: true });
    const token = generateCsrfToken(jwtSecret);

    expect(() =>
      guard.canActivate(
        createContext({
          method: 'POST',
          headers: {
            cookie: `schoolos_csrf=${token}`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toThrow(new ForbiddenException('CSRF cookie missing'));

    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          headers: {
            cookie: `__Host-schoolos_csrf=${token}`,
            'x-csrf-token': token,
          },
        }),
      ),
    ).toBe(true);
  });

  function createGuard(options: { isProduction: boolean }) {
    return new CsrfGuard({
      isProduction: options.isProduction,
      jwtSecret,
    } as ConfigService);
  }

  function createContext(input: {
    method: string;
    path?: string;
    headers?: Record<string, string>;
  }) {
    const request = {
      method: input.method,
      path: input.path ?? '/api/v1/dashboard/mutate',
      headers: input.headers ?? {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }
});
