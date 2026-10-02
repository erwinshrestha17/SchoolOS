import { NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import {
  assertStaffDocumentKindVisible,
  canManageStaffDocumentKind,
  canReadStaffDocumentKind,
  hiddenStaffDocumentKinds,
  isRestrictedStaffDocumentKind,
  requireStaffDocumentKindManage,
} from './staff-restricted.policy';

const base: AuthContext = {
  tenantId: 'tenant',
  userId: 'user',
  tenantSlug: 'school',
  email: 'hr@example.test',
  roles: ['hr'],
  permissions: ['hr:staff:read', 'hr:documents:read', 'hr:documents:manage'],
  authMethod: 'PASSWORD',
};
const withPermissions = (...permissions: string[]): AuthContext => ({
  ...base,
  permissions: [...base.permissions, ...permissions],
});

describe('Restricted staff document policy', () => {
  it('classifies medical, disciplinary and safeguarding as restricted only', () => {
    expect(isRestrictedStaffDocumentKind('MEDICAL')).toBe(true);
    expect(isRestrictedStaffDocumentKind('DISCIPLINARY')).toBe(true);
    expect(isRestrictedStaffDocumentKind('SAFEGUARDING')).toBe(true);
    expect(isRestrictedStaffDocumentKind('OFFER_LETTER')).toBe(false);
  });

  it('generic document authority reads ordinary kinds but no restricted kind', () => {
    expect(canReadStaffDocumentKind(base, 'OFFER_LETTER')).toBe(true);
    expect(canReadStaffDocumentKind(base, 'MEDICAL')).toBe(false);
    expect(canReadStaffDocumentKind(base, 'SAFEGUARDING')).toBe(false);
    expect(canReadStaffDocumentKind(base, 'DISCIPLINARY')).toBe(false);
    expect(hiddenStaffDocumentKinds(base).sort()).toEqual([
      'DISCIPLINARY',
      'MEDICAL',
      'SAFEGUARDING',
    ]);
  });

  it('a category permission alone is not enough without document authority', () => {
    const actor: AuthContext = {
      ...base,
      permissions: ['hr:medical:read', 'hr:medical:manage'],
    };
    expect(canReadStaffDocumentKind(actor, 'MEDICAL')).toBe(false);
    expect(canManageStaffDocumentKind(actor, 'MEDICAL')).toBe(false);
  });

  it('each category permission unlocks only its own kind', () => {
    const medical = withPermissions('hr:medical:read', 'hr:medical:manage');
    expect(canReadStaffDocumentKind(medical, 'MEDICAL')).toBe(true);
    expect(canManageStaffDocumentKind(medical, 'MEDICAL')).toBe(true);
    expect(canReadStaffDocumentKind(medical, 'SAFEGUARDING')).toBe(false);
    expect(hiddenStaffDocumentKinds(medical).sort()).toEqual([
      'DISCIPLINARY',
      'SAFEGUARDING',
    ]);
  });

  it('read does not imply manage', () => {
    const reader = withPermissions('hr:safeguarding:read');
    expect(canReadStaffDocumentKind(reader, 'SAFEGUARDING')).toBe(true);
    expect(canManageStaffDocumentKind(reader, 'SAFEGUARDING')).toBe(false);
    expect(() => {
      requireStaffDocumentKindManage(reader, 'SAFEGUARDING');
    }).toThrow();
    expect(() => {
      requireStaffDocumentKindManage(reader, 'OFFER_LETTER');
    }).not.toThrow();
  });

  it('hides existence of restricted documents behind NotFound', () => {
    expect(() => {
      assertStaffDocumentKindVisible(base, 'MEDICAL');
    }).toThrow(NotFoundException);
    expect(() => {
      assertStaffDocumentKindVisible(
        withPermissions('hr:medical:read'),
        'MEDICAL',
      );
    }).not.toThrow();
  });

  it('Platform and support actors never inherit category permissions', () => {
    const all = withPermissions(
      'hr:medical:read',
      'hr:medical:manage',
      'hr:safeguarding:read',
      'hr:disciplinary:read',
    );
    for (const actor of [
      { ...all, securityDomain: 'PLATFORM' as const },
      { ...all, isSupportOverride: true },
    ]) {
      expect(canReadStaffDocumentKind(actor, 'MEDICAL')).toBe(false);
      expect(canReadStaffDocumentKind(actor, 'OFFER_LETTER')).toBe(false);
      expect(canManageStaffDocumentKind(actor, 'MEDICAL')).toBe(false);
    }
  });
});
