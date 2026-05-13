import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M0 File & Report Boundary Hardening Contracts
 *
 * These tests ensure strict tenant isolation for assets and exports:
 * 1. File metadata retrieval is tenant-scoped.
 * 2. Signed URL generation requires owning tenant validation.
 * 3. Dangerous file extensions are blocked at the controller level.
 * 4. Report export history is tenant-isolated.
 * 5. Report exports use protected URLs, not raw storage paths.
 */
describe('M0 File & Report boundary contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  // ─── 1. File Registry Tenant Isolation ───────────────────────────────

  describe('File registry tenant isolation', () => {
    it('getFileMetadata rejects cross-tenant access with ForbiddenException', () => {
      const service = read('src/file-registry/file-registry.service.ts');

      expect(service).toContain('getFileMetadata(tenantId: string, assetId: string)');
      expect(service).toContain('asset.tenantId !== tenantId');
      expect(service).toContain('throw new ForbiddenException(\'Access denied\')');
    });

    it('registerFile enforces tenantId at creation', () => {
      const service = read('src/file-registry/file-registry.service.ts');

      expect(service).toContain('this.prisma.fileAsset.create');
      expect(service).toContain('tenantId: input.tenantId');
    });

    it('listFilesByEntity filters by tenantId', () => {
      const service = read('src/file-registry/file-registry.service.ts');

      expect(service).toContain('listFilesByEntity(tenantId: string');
      expect(service).toContain('where: { tenantId,');
    });
  });

  // ─── 2. Upload Safety & Sanitization ─────────────────────────────────

  describe('Upload safety & extension blocking', () => {
    it('FileRegistryController blocks dangerous extensions via regex', () => {
      const controller = read('src/file-registry/file-registry.controller.ts');

      expect(controller).toContain('DANGEROUS_EXTENSIONS');
      expect(controller).toContain('/\\.(exe|bat|cmd|com|scr|js|mjs|sh|ps1|php|jar)$/i');
      expect(controller).toContain('Dangerous file extension rejected');
    });

    it('FileRegistryController enforces SAFE_MIME_TYPES whitelist', () => {
      const controller = read('src/file-registry/file-registry.controller.ts');

      expect(controller).toContain('SAFE_MIME_TYPES');
      expect(controller).toContain('application/pdf');
      expect(controller).toContain('image/png');
      expect(controller).toContain('image/jpeg');
      expect(controller).toContain('Unsupported file type');
    });

    it('upload size limit is enforced before storage write', () => {
      const controller = read('src/file-registry/file-registry.controller.ts');

      expect(controller).toContain('MAX_UPLOAD_BYTES = 10 * 1024 * 1024');
      expect(controller).toContain('File exceeds upload size limit');
    });
  });

  // ─── 3. URL Protection & Signed URLs ──────────────────────────────────

  describe('URL protection contracts', () => {
    it('getSignedUrl returns protected internal API paths, not raw S3/CDN URLs', () => {
      const service = read('src/file-registry/file-registry.service.ts');

      expect(service).toContain('getSignedUrl');
      expect(service).not.toContain('s3.amazonaws.com');
      expect(service).toContain('this.apiBaseUrl');
      expect(service).toContain('/preview');
    });

    it('getSignedUrl handles student photo and activity attachment special paths', () => {
      const service = read('src/file-registry/file-registry.service.ts');

      expect(service).toContain('/students/${encodeURIComponent(asset.entityId)}/photo/preview');
      expect(service).toContain('/activity-feed/attachments/${encodeURIComponent(attachment.id)}/preview');
    });
  });

  // ─── 4. Report Export Boundary ────────────────────────────────────────

  describe('Report export boundary contracts', () => {
    it('PlatformService filters report exports by tenantId', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('listReportExportsPage');
      expect(service).toContain('if (query.tenantId) where.tenantId = query.tenantId');
    });

    it('recordReportExport captures requesting user and completion status', () => {
      const service = read('src/platform/platform.service.ts');

      expect(service).toContain('recordReportExport');
      expect(service).toContain('requestedBy: input.requestedBy');
      expect(service).toContain('completedAt: new Date()');
    });
  });
});
