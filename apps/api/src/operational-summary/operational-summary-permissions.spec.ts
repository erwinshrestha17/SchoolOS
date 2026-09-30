import { permissionCatalog } from '@schoolos/core';
import {
  METRIC_PERMISSIONS,
  MODULE_CONFIG,
  RECENT_PERMISSIONS,
} from './operational-summary.service';

/**
 * Every permission the operational summary checks must exist in the core
 * catalogue: a made-up key (like the former `fees:read`) silently grants or
 * denies nothing and hides the real requirement.
 */
describe('operational summary permission references', () => {
  const known = new Set(
    permissionCatalog.map((entry) => `${entry.resource}:${entry.action}`),
  );
  const referenced = [
    ...Object.values(MODULE_CONFIG).flatMap((config) => config.permissions),
    ...Object.values(METRIC_PERMISSIONS).flat(),
    ...Object.values(RECENT_PERMISSIONS).flatMap((list) => list ?? []),
  ];

  it('only references catalogued permissions', () => {
    expect(
      [...new Set(referenced)].filter((key) => !known.has(key)).sort(),
    ).toEqual([]);
  });
});
