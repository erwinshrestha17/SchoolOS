import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Run only against an empty disposable local database; no destructive reset.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');
  const url = new URL(connectionString);
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !url.pathname.endsWith('_scope_migration_test')
  )
    throw new Error(
      'A disposable local _scope_migration_test database is required',
    );
  const sql = new Client({ connectionString });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  await sql.connect();
  try {
    assert.equal(
      (
        await sql.query(
          "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
        )
      ).rows[0].n,
      0,
    );
    const directory = resolve(__dirname, '../migrations');
    const migrations = (await readdir(directory))
      .filter((name) => /^\d/.test(name))
      .sort();
    async function apply(name: string) {
      await sql.query('BEGIN');
      try {
        await sql.query(
          await readFile(resolve(directory, name, 'migration.sql'), 'utf8'),
        );
        await sql.query('COMMIT');
      } catch (error) {
        await sql.query('ROLLBACK');
        throw error;
      }
    }
    const baseline = migrations.filter((name) => name < '20260927100000');
    for (const name of baseline) await apply(name);
    const beforePermissions = await db.permission.count();
    const beforeRolePermissions = await db.rolePermission.count();
    const tenant = await db.tenant.create({
      data: { name: 'Synthetic replay', slug: 'scope-replay' },
    });
    const foreign = await db.tenant.create({
      data: { name: 'Synthetic foreign', slug: 'scope-foreign' },
    });
    const tenantId = tenant.id;
    const user = await db.user.create({
      data: { tenantId, email: 'scope@example.invalid', status: 'ACTIVE' },
    });
    const role = await db.role.create({
      data: { tenantId, name: 'synthetic-scope-reader' },
    });
    const classroom = await db.class.create({
      data: { tenantId, name: 'One', level: 1 },
    });
    const foreignClass = await db.class.create({
      data: { tenantId: foreign.id, name: 'Foreign', level: 1 },
    });
    const section = await db.section.create({
      data: { tenantId, classId: classroom.id, name: 'A' },
    });
    const badSection = await db.section.create({
      data: { tenantId, classId: foreignClass.id, name: 'Legacy corrupted' },
    });
    const year = await db.academicYear.create({
      data: {
        tenantId,
        name: 'Replay',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2027-01-01'),
      },
    });
    const subject = await db.subject.create({
      data: {
        tenantId,
        classId: classroom.id,
        name: 'English',
        code: 'ENG',
        type: 'CORE',
      },
    });
    const student = await db.student.create({
      data: {
        tenantId,
        classId: classroom.id,
        sectionId: section.id,
        studentSystemId: 'SYNTHETIC',
        firstNameEn: 'Synthetic',
        lastNameEn: 'Student',
        dateOfBirth: new Date('2016-01-01'),
        gender: 'OTHER',
        admissionDate: new Date(),
      },
    });
    const staff = await db.staff.create({
      data: {
        tenantId,
        userId: user.id,
        employeeId: 'SYNTHETIC',
        firstName: 'Synthetic',
        lastName: 'Staff',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
        address: 'Synthetic',
        joiningDate: new Date(),
        contractType: 'PERMANENT',
      },
    });
    const account = await db.chartAccount.create({
      data: { tenantId, code: 'SYNTHETIC', name: 'Synthetic', type: 'ASSET' },
    });
    const mapped = new Map<string, string>();
    for (const [scopeType, scopeId] of [
      ['TENANT', null],
      ['TENANT', tenantId],
      ['ACADEMIC_YEAR', year.id],
      ['CLASS', classroom.id],
      ['SECTION', section.id],
      ['SUBJECT', subject.id],
      ['STUDENT', student.id],
      ['STAFF', staff.id],
      ['FINANCE_ACCOUNT', account.id],
    ] as const) {
      const assignment = await db.userRole.create({
        data: { tenantId, userId: user.id, roleId: role.id, scopeId },
      });
      mapped.set(assignment.id, scopeType);
    }
    const collision = await db.class.create({
      data: { tenantId, name: 'Collision', level: 2 },
    });
    await db.section.create({
      data: {
        id: collision.id,
        tenantId,
        classId: classroom.id,
        name: 'Collision',
      },
    });
    const unmapped: string[] = [];
    for (const scopeId of [
      collision.id,
      'unknown-legacy-target',
      foreignClass.id,
    ]) {
      unmapped.push(
        (
          await db.userRole.create({
            data: { tenantId, userId: user.id, roleId: role.id, scopeId },
          })
        ).id,
      );
    }
    await apply('20260927100000_typed_role_scopes');
    const grants = await sql.query(
      'SELECT "userRoleAssignmentId", "scopeType" FROM "RoleScopeGrant"',
    );
    assert.equal(grants.rowCount, mapped.size);
    for (const grant of grants.rows)
      assert.equal(grant.scopeType, mapped.get(grant.userRoleAssignmentId));
    const reviews = await sql.query(
      'SELECT "resourceId" FROM "AuditLog" WHERE action=\'scope_migration_review_required\'',
    );
    assert.deepEqual(
      reviews.rows.map((row) => row.resourceId).sort(),
      unmapped.sort(),
    );
    assert.equal(await db.userRole.count(), mapped.size + unmapped.length);
    assert.equal(await db.rolePermission.count(), beforeRolePermissions);
    assert.equal(await db.permission.count(), beforePermissions);
    await assert.rejects(
      apply('20260927101000_priority_tenant_object_integrity'),
      /Tenant integrity preflight failed/,
    );
    assert.equal(
      (await db.section.findUniqueOrThrow({ where: { id: badSection.id } }))
        .classId,
      foreignClass.id,
    );
    assert.equal(
      (
        await sql.query(
          "SELECT count(*)::int AS n FROM pg_proc WHERE proname='schoolos_check_tenant_reference'",
        )
      ).rows[0].n,
      0,
    );
    await db.section.update({
      where: { id: badSection.id },
      data: { classId: classroom.id },
    });
    await apply('20260927101000_priority_tenant_object_integrity');
    await apply('20260927102000_role_scope_supersession');
    await assert.rejects(
      db.section.update({
        where: { id: badSection.id },
        data: { classId: foreignClass.id },
      }),
      /Tenant-owned reference is not available/,
    );
    await assert.rejects(
      db.userRole.create({
        data: {
          tenantId,
          userId: user.id,
          roleId: role.id,
          scopeId: badSection.id,
        },
      }),
      /explicit typed grant/,
    );
    console.log(
      JSON.stringify({
        baselineMigrations: baseline.length,
        newMigrations: 3,
        deterministicLegacyGrants: mapped.size,
        unresolvedRetainedAndAudited: unmapped.length,
        corruptionPreflightRollback: true,
        noPermissionGrants: true,
        finalForeignLinkDenied: true,
      }),
    );
  } finally {
    await db.$disconnect();
    await sql.end();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
