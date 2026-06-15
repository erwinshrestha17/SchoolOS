import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

describe('advanced operations backend integration contracts', () => {
  it('mounts the advanced operations module in the backend app only', () => {
    const appModule = fs.readFileSync(
      path.join(root, 'src/app.module.ts'),
      'utf8',
    );

    expect(appModule).toContain('AdvancedOperationsModule');
    expect(appModule).not.toContain('apps/web');
    expect(appModule).not.toContain('schoolos_mobile');
  });

  it('keeps approval, automation, analytics, templates, and exports tenant scoped', () => {
    const schema = fs.readFileSync(
      path.join(root, 'prisma/schema/advanced-operations.prisma'),
      'utf8',
    );

    for (const model of [
      'ApprovalRequest',
      'AutomationRule',
      'AnalyticsSummary',
      'DocumentTemplate',
      'GeneratedDocument',
      'DataExportJob',
    ]) {
      expect(schema).toContain(`model ${model}`);
    }
    expect(schema).toContain('@@unique([tenantId, idempotencyKey])');
    expect(schema).toContain('@@index([tenantId, status, createdAt])');
  });

  it('requires permissions on every advanced operations controller', () => {
    const controllerDir = path.join(root, 'src/advanced-operations');
    const controllers = fs
      .readdirSync(controllerDir)
      .filter((file) => file.endsWith('.controller.ts'));

    expect(controllers.length).toBeGreaterThanOrEqual(5);
    for (const controller of controllers) {
      const source = fs.readFileSync(
        path.join(controllerDir, controller),
        'utf8',
      );
      expect(source).toContain('RolesPermissionsGuard');
      expect(source).toContain('@Permissions(');
      expect(source).toContain('TenantActiveGuard');
    }
  });
});
