import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ENTITLEMENT_KEY } from '../auth/decorators/entitlement.decorator';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { PayablesController } from './payables.controller';

/**
 * Phase 7.11c: every payables route is authenticated, entitlement-gated and
 * names exactly one duty. Preparing, approving, paying and reversing are
 * different permissions, so no single grant opens two duties.
 */
describe('PayablesController route policy (Phase 7.11c)', () => {
  const expected: Record<string, string> = {
    getSetup: 'accounting:payables:read',
    listVendors: 'accounting:vendors:read',
    createVendor: 'accounting:vendors:write',
    updateVendor: 'accounting:vendors:write',
    deactivateVendor: 'accounting:vendors:write',
    listBills: 'accounting:expenses:read',
    getBill: 'accounting:expenses:read',
    createBill: 'accounting:expenses:write',
    updateBill: 'accounting:expenses:write',
    submitBill: 'accounting:expenses:write',
    approveBill: 'accounting:expenses:approve',
    rejectBill: 'accounting:expenses:approve',
    reverseBill: 'accounting:journals:reverse',
    listPayables: 'accounting:payables:read',
    getPayable: 'accounting:payables:read',
    settle: 'accounting:payables:settle',
    reverseSettlement: 'accounting:journals:reverse',
    getPayablesAging: 'accounting:payables:read',
  };

  it('is authenticated and requires the accounting module', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      PayablesController,
    ) as unknown[];
    expect(guards).toEqual([
      JwtAuthGuard,
      RolesPermissionsGuard,
      EntitlementGuard,
    ]);
    expect(Reflect.getMetadata(ENTITLEMENT_KEY, PayablesController)).toBe(
      'module.accounting',
    );
  });

  it('declares exactly one duty permission per route', () => {
    const prototype = PayablesController.prototype as unknown as Record<
      string,
      unknown
    >;
    const handlers = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers.sort()).toEqual(Object.keys(expected).sort());
    for (const name of handlers) {
      expect([
        name,
        Reflect.getMetadata(PERMISSIONS_KEY, prototype[name] as object),
      ]).toEqual([name, [expected[name]]]);
    }
  });
});
