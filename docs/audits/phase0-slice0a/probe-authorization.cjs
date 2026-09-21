// Source-backed synthetic probes only. No database/provider writes or real identities.
// Run after pnpm --filter @schoolos/api build from the repository root.
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const { AuthzCacheService } = require(path.join(root, 'apps/api/dist/apps/api/src/auth/authz-cache.service.js'));
const { FileRegistryService } = require(path.join(root, 'apps/api/dist/apps/api/src/file-registry/file-registry.service.js'));
const { ReportsService } = require(path.join(root, 'apps/api/dist/apps/api/src/reports/reports.service.js'));
(async () => {
  const resolver = Object.create(AuthzCacheService.prototype);
  resolver.load = async () => ({grants: [{role:'custom-scoped-reader', scopeId:'section-only', expiresAt:null, permissions:['students:read']}]});
  const resolved = await resolver.resolve('synthetic-tenant','synthetic-user','SCHOOL');
  assert.deepEqual(resolved.permissions,['students:read']);
  assert.equal('scopeId' in resolved,false);
  console.log('CONFIRMED: school scopeId is discarded by effective role resolution. This does not prove every downstream endpoint lacks resource checks.');
  const reports = Object.create(ReportsService.prototype);
  reports.plansService = {assertTenantActive: async () => {}};
  let executed = false;
  const stop = new Error('stop before artifact generation');
  reports.registry = new Map([['synthetic-report',{definition:{requiredPermissions:['reports:export'],formats:['csv'],module:'finance'},execute:async()=>{executed=true;throw stop;}}]]);
  reports.assertTeacherReportScope = async () => {}; // non-teacher path is a no-op in source
  const actor={tenantId:'synthetic-tenant',userId:'revoked-user',roles:['accountant'],permissions:['reports:export']};
  await assert.rejects(reports.completeQueuedExport({exportId:'synthetic-export',reportKey:'synthetic-report',filters:{},format:'csv',actor}),e=>e===stop);
  assert.equal(executed,true);
  console.log('CONFIRMED: queued export reaches its executor using the payload permission snapshot without loading current user/session/role grants. Synthetic control-flow proof, not live queue delivery.');
  const files = Object.create(FileRegistryService.prototype);
  files.plansService = {assertTenantActive:async()=>{}};
  await files.assertFileAccessForAuth({tenantId:'synthetic-tenant',status:'UPLOADED',visibility:'PRIVATE',module:'notices',entityId:'unreadable-notice'}, {tenantId:'synthetic-tenant',userId:'synthetic-parent',roles:['parent'],permissions:['notices:read']});
  console.log('CONFIRMED: generic non-OWNER notice file authorization accepts notices:read without looking up notice audience or publication state. Asset-ID possession required; no cross-tenant claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
