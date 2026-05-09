import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const API_ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(API_ROOT, 'prisma', 'schema.prisma');
const MIGRATIONS_ROOT = join(API_ROOT, 'prisma', 'migrations');

function readSchema() {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`schema.prisma not found at ${SCHEMA_PATH}`);
  }

  return readFileSync(SCHEMA_PATH, 'utf8');
}

function readMigrations() {
  if (!existsSync(MIGRATIONS_ROOT)) {
    return '';
  }

  const chunks: string[] = [];

  for (const migrationDir of readdirSync(MIGRATIONS_ROOT)) {
    const migrationPath = join(MIGRATIONS_ROOT, migrationDir);
    if (!statSync(migrationPath).isDirectory()) {
      continue;
    }

    const sqlPath = join(migrationPath, 'migration.sql');
    if (existsSync(sqlPath)) {
      chunks.push(readFileSync(sqlPath, 'utf8'));
    }
  }

  return chunks.join('\n');
}

function modelBlock(schema: string, modelName: string) {
  const match = schema.match(
    new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`),
  );

  if (!match) {
    throw new Error(`Model ${modelName} not found`);
  }

  return match[1];
}

function hasPrismaIndex(schema: string, modelName: string, fields: string[]) {
  const block = modelBlock(schema, modelName).replace(/\s+/g, ' ');
  const fieldPattern = fields.map((field) => `"?${field}"?`).join('\\s*,\\s*');
  return new RegExp(`@@(?:index|unique)\\s*\\(\\s*\\[\\s*${fieldPattern}`).test(
    block,
  );
}

function hasSqlIndex(sql: string, tableName: string, fields: string[]) {
  const normalized = sql.replace(/\s+/g, ' ');
  const fieldPattern = fields.map((field) => `"${field}"`).join('\\s*,\\s*');
  return new RegExp(
    `CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+"[^"]+"\\s+ON\\s+"${tableName}"\\s*\\(\\s*${fieldPattern}`,
    'i',
  ).test(normalized);
}

function hasIndex(
  schema: string,
  sql: string,
  modelName: string,
  tableName: string,
  fields: string[],
) {
  return (
    hasPrismaIndex(schema, modelName, fields) ||
    hasSqlIndex(sql, tableName, fields)
  );
}

describe('schema index hardening gate', () => {
  const schema = readSchema();
  const migrations = readMigrations();

  it('keeps high-volume notification delivery indexes available', () => {
    expect(
      hasIndex(
        schema,
        migrations,
        'NotificationDelivery',
        'NotificationDelivery',
        ['tenantId', 'sourceType', 'sourceId'],
      ),
    ).toBe(true);
    expect(
      hasIndex(
        schema,
        migrations,
        'NotificationDelivery',
        'NotificationDelivery',
        ['tenantId', 'recipientUserId'],
      ),
    ).toBe(true);
    expect(
      hasIndex(
        schema,
        migrations,
        'NotificationDelivery',
        'NotificationDelivery',
        ['tenantId', 'status', 'createdAt'],
      ),
    ).toBe(true);
  });

  it('keeps notification read receipt lookup indexes available', () => {
    expect(
      hasIndex(
        schema,
        migrations,
        'NotificationReadReceipt',
        'NotificationReadReceipt',
        ['tenantId', 'userId', 'readAt'],
      ),
    ).toBe(true);
    expect(
      hasIndex(
        schema,
        migrations,
        'NotificationReadReceipt',
        'NotificationReadReceipt',
        ['tenantId', 'notificationDeliveryId', 'userId'],
      ),
    ).toBe(true);
  });

  it('keeps homework due/status and submission lookup indexes available', () => {
    expect(
      hasIndex(schema, migrations, 'HomeworkAssignment', 'HomeworkAssignment', [
        'tenantId',
        'status',
        'dueDate',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'HomeworkAssignment', 'HomeworkAssignment', [
        'tenantId',
        'classId',
        'sectionId',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'HomeworkSubmission', 'HomeworkSubmission', [
        'tenantId',
        'studentId',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'HomeworkAttachment', 'HomeworkAttachment', [
        'tenantId',
        'fileAssetId',
      ]),
    ).toBe(true);
  });

  it('keeps timetable high-volume conflict lookup indexes available', () => {
    expect(
      hasIndex(schema, migrations, 'TimetableSlot', 'TimetableSlot', [
        'tenantId',
        'staffId',
        'dayOfWeek',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'TimetableSlot', 'TimetableSlot', [
        'tenantId',
        'roomId',
        'dayOfWeek',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'TimetableSlot', 'TimetableSlot', [
        'tenantId',
        'classId',
        'sectionId',
      ]),
    ).toBe(true);
    expect(
      hasIndex(
        schema,
        migrations,
        'TimetableSubstitution',
        'TimetableSubstitution',
        ['tenantId', 'date', 'status'],
      ),
    ).toBe(true);
  });

  it('keeps parent-teacher chat thread and message indexes available', () => {
    expect(
      hasIndex(schema, migrations, 'Conversation', 'Conversation', [
        'tenantId',
        'studentId',
        'academicYearId',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'Message', 'Message', [
        'tenantId',
        'conversationId',
        'createdAt',
      ]),
    ).toBe(true);
    expect(
      hasIndex(schema, migrations, 'MessageReadReceipt', 'MessageReadReceipt', [
        'tenantId',
        'userId',
        'readAt',
      ]),
    ).toBe(true);
  });
});
