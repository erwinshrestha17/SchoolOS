import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MustChangePasswordGuard } from './must-change-password.guard';

function makeContext(auth?: {
  mustChangePassword?: boolean;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ auth }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as ExecutionContext;
}

describe('MustChangePasswordGuard (P1-01)', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: MustChangePasswordGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new MustChangePasswordGuard(reflector);
  });

  it('passes when auth is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('passes when mustChangePassword is false', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    expect(
      guard.canActivate(makeContext({ mustChangePassword: false })),
    ).toBe(true);
  });

  it('passes when route is allowlisted via SkipMustChangePassword', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(
      guard.canActivate(makeContext({ mustChangePassword: true })),
    ).toBe(true);
  });

  it('blocks sensitive routes when mustChangePassword is true', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    expect(() =>
      guard.canActivate(makeContext({ mustChangePassword: true })),
    ).toThrow(
      new ForbiddenException(
        'Password change required before accessing this resource',
      ),
    );
  });
});
