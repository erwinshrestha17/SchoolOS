import type { SchoolSettingsDomain } from './school-settings-domains.js';
import { getSchoolSettingsKeysForDomain } from './school-settings-domains.js';
import type { TenantSettingKey, TenantSettingSummary } from './types.js';

export type SchoolSettingsDomainChange = {
  key: TenantSettingKey;
  value: unknown;
};

export type UpdateSchoolSettingsDomainPayload = {
  expectedVersion: string;
  idempotencyKey: string;
  reason: string;
  changes: SchoolSettingsDomainChange[];
};

export type UpdateSchoolSettingsDomainResult = {
  success: true;
  domain: SchoolSettingsDomain;
  changedKeys: TenantSettingKey[];
  version: string;
  replayed: boolean;
};

/**
 * Optimistic-concurrency token derived only from server-owned setting
 * timestamps. It is intentionally stable across browser/server and contains no
 * setting values.
 */
export function buildSchoolSettingsDomainVersion(
  settings: readonly TenantSettingSummary[],
  domain: SchoolSettingsDomain,
): string {
  const keys = new Set(getSchoolSettingsKeysForDomain(domain));
  const scoped = settings
    .filter((setting) => keys.has(setting.key))
    .map((setting) => `${setting.key}@${setting.updatedAt}`)
    .sort();
  return scoped.length ? scoped.join('|') : 'empty';
}
