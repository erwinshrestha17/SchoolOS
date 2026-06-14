import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M0 Queue & Provider Safety Hardening Contracts
 *
 * These tests ensure the operational safety of the platform's infrastructure:
 * 1. Provider secret masking (sensitive config never leaks).
 * 2. Provider config encryption at rest.
 * 3. Queue health visibility across all platform topologies.
 * 4. Failed-job retry safety (permissioned and audited).
 * 5. Sanitization of job data in UI responses.
 */
describe('M0 Queue & Provider safety contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  // ─── 1. Provider Secret Masking ───────────────────────────────────────

  describe('Provider secret masking', () => {
    it('toProviderSummary masks keys defined in secretKeys', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('toProviderSummary');
      expect(service).toContain("config[key] = '********'");
    });

    it('upsertProvider auto-detects secret keys if not provided', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('detectSecretKeys');
      expect(service).toContain('/(secret|token|key|password|credential)/i');
    });

    it('provider config is encrypted before saving to DB', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('encryptProviderConfig');
      expect(service).toContain('encryptSensitiveField');
    });
  });

  // ─── 2. Queue Topology & Health ───────────────────────────────────────

  describe('Queue health & topology', () => {
    it('PlatformQueuesService monitors all platform-visible queue topologies', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain("'notifications'");
      expect(service).toContain("'finance'");
      expect(service).toContain("'payroll'");
      expect(service).toContain("'activity-media'");
      expect(service).toContain("'homework'");
      expect(service).toContain("'reports'");
      expect(service).toContain("'canteen-alerts'");
    });

    it('getQueueHealth reports worker health status', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain('workerHealth');
      expect(service).toContain("'healthy'");
      expect(service).toContain("'degraded'");
      expect(service).toContain("'unknown'");
    });

    it('getQueueHealth includes waiting, active, and failed counts', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain("waiting: this.count(counts, 'waiting')");
      expect(service).toContain("active: this.count(counts, 'active')");
      expect(service).toContain("failed: this.count(counts, 'failed')");
    });

    it('failed-job grouping exposes bounded diagnostics without job payloads', () => {
      const controller = read('src/platform/platform.controller.ts');
      const service = read('src/platform/platform-queues.service.ts');

      expect(controller).toContain("@Get('queues/failed-job-groups')");
      expect(controller).toContain(
        'platformQueuesService.listFailedJobGroups()',
      );
      expect(service).toContain('listFailedJobGroups');
      expect(service).toContain('buildFailureDiagnostic');
      expect(service).toContain('affectedTenantIds');
      expect(service).toContain('sampleJobIds');
    });

    it('destructive failed-job discard records an operator reason', () => {
      const service = read('src/platform/platform-queues.service.ts');
      const controller = read('src/platform/platform.controller.ts');

      expect(controller).toContain('RemovePlatformJobDto');
      expect(service).toContain('RemovePlatformJobDto');
      expect(service).toContain('reason: dto.reason');
      expect(service).toContain("action: 'queue_job_removed'");
    });
  });

  // ─── 3. Failed Job & Retry Safety ─────────────────────────────────────

  describe('Failed job & retry safety', () => {
    it('listFailedJobs sanitizes data to prevent secret leakage in UI', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain('sanitizeJobData(job.data)');
      expect(service).toContain('SECRET_KEY_PATTERN.test(key)');
      expect(service).toContain("'********'");
    });

    it('sanitizeJobData truncates long strings and deep objects', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain('MAX_STRING_LENGTH = 500');
      expect(service).toContain('depth > 4');
      expect(service).toContain("'[Truncated]'");
    });

    it('retryFailedJob validates job is actually failed before retry', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain('job.isFailed()');
      expect(service).toContain('Job ${dto.jobId} is not in failed state');
    });

    it('retryFailedJob is permissioned via controller decorator', () => {
      const controller = read('src/platform/platform.controller.ts');

      expect(controller).toContain("@Post('queues/retry')");
      expect(controller).toContain("@Permissions('platform:queues:retry')");
    });

    it('retry attempts are audited with reason', () => {
      const service = read('src/platform/platform-queues.service.ts');

      expect(service).toContain('queue_failed_job_retry_requested');
      expect(service).toContain('reason: dto.reason');
    });
  });
});
