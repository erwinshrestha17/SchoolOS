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
      durationMinutes: '30',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.durationMinutes).toBe(30);
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
