import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  EnterSupportOverrideDto,
  PlatformTenantBillingStatusReasonDto,
  UpdateProviderStatusDto,
} from './platform-core.dto';

describe('Platform control-plane DTOs', () => {
  it('requires an audit reason when disabling a provider', () => {
    const dto = plainToInstance(UpdateProviderStatusDto, {
      enabled: false,
    });

    expect(validateSync(dto).map((error) => error.property)).toContain(
      'reason',
    );
  });

  it('allows provider enable requests without a reason', () => {
    const dto = plainToInstance(UpdateProviderStatusDto, {
      enabled: true,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('validates support override requests and coerces duration', () => {
    const dto = plainToInstance(EnterSupportOverrideDto, {
      tenantId: 'tenant-1',
      reason: 'Investigating support ticket',
      scopes: ['ATTENDANCE'],
      durationMinutes: '30',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.durationMinutes).toBe(30);
  });

  it('rejects unscoped, unknown, and overlong support overrides', () => {
    const unscoped = plainToInstance(EnterSupportOverrideDto, {
      tenantId: 'tenant-1',
      reason: 'Investigating support ticket',
      scopes: [],
    });
    const unknown = plainToInstance(EnterSupportOverrideDto, {
      tenantId: 'tenant-1',
      reason: 'Investigating support ticket',
      scopes: ['FINANCE_WRITE'],
    });
    const overlong = plainToInstance(EnterSupportOverrideDto, {
      tenantId: 'tenant-1',
      reason: 'Investigating support ticket',
      scopes: ['ATTENDANCE'],
      durationMinutes: 61,
    });

    expect(validateSync(unscoped).map((error) => error.property)).toContain(
      'scopes',
    );
    expect(validateSync(unknown).map((error) => error.property)).toContain(
      'scopes',
    );
    expect(validateSync(overlong).map((error) => error.property)).toContain(
      'durationMinutes',
    );
  });

  it('requires a concrete reason for billing suspension changes', () => {
    const dto = plainToInstance(PlatformTenantBillingStatusReasonDto, {
      reason: 'late',
    });

    expect(validateSync(dto).map((error) => error.property)).toContain(
      'reason',
    );
  });
});
