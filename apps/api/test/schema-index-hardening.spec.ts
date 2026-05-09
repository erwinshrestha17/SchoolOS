import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SCHEMA_PATH = join(__dirname, '..', 'prisma', 'schema.prisma');

function readSchema() {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`schema.prisma not found at ${SCHEMA_PATH}`);
  }

  return readFileSync(SCHEMA_PATH, 'utf8');
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

function hasIndex(block: string, fields: string[]) {
  const normalized = block.replace(/\s+/g, ' ');
  const fieldPattern = fields.map((field) => `"?${field}"?`).join('\\s*,\\s*');
  return new RegExp(`@@(?:index|unique)\\s*\\(\\s*\\[\\s*${fieldPattern}`).test(
    normalized,
  );
}

describe('schema index hardening gate', () => {
  const schema = readSchema();

  it('keeps high-volume notification delivery indexes available', () => {
    const block = modelBlock(schema, 'NotificationDelivery');

    expect(hasIndex(block, ['tenantId', 'sourceType', 'sourceId'])).toBe(true);
    expect(hasIndex(block, ['tenantId', 'recipientUserId'])).toBe(true);
    expect(hasIndex(block, ['tenantId', 'status', 'createdAt'])).toBe(true);
  });

  it('keeps notification read receipt lookup indexes available', () => {
    const block = modelBlock(schema, 'NotificationReadReceipt');

    expect(hasIndex(block, ['tenantId', 'userId', 'readAt'])).toBe(true);
    expect(hasIndex(block, ['tenantId', 'notificationDeliveryId', 'userId'])).toBe(
      true,
    );
  });

  it('keeps homework due/status and submission lookup indexes available', () => {
    const assignmentBlock = modelBlock(schema, 'HomeworkAssignment');
    const submissionBlock = modelBlock(schema, 'HomeworkSubmission');
    const attachmentBlock = modelBlock(schema, 'HomeworkAttachment');

    expect(hasIndex(assignmentBlock, ['tenantId', 'status', 'dueDate'])).toBe(
      true,
    );
    expect(hasIndex(assignmentBlock, ['tenantId', 'classId', 'sectionId'])).toBe(
      true,
    );
    expect(hasIndex(submissionBlock, ['tenantId', 'studentId'])).toBe(true);
    expect(hasIndex(attachmentBlock, ['tenantId', 'fileAssetId'])).toBe(true);
  });

  it('keeps timetable high-volume conflict lookup indexes available', () => {
    const slotBlock = modelBlock(schema, 'TimetableSlot');
    const substitutionBlock = modelBlock(schema, 'TimetableSubstitution');

    expect(hasIndex(slotBlock, ['tenantId', 'staffId', 'dayOfWeek'])).toBe(true);
    expect(hasIndex(slotBlock, ['tenantId', 'roomId', 'dayOfWeek'])).toBe(true);
    expect(hasIndex(slotBlock, ['tenantId', 'classId', 'sectionId'])).toBe(true);
    expect(hasIndex(substitutionBlock, ['tenantId', 'date', 'status'])).toBe(
      true,
    );
  });

  it('keeps parent-teacher chat thread and message indexes available', () => {
    const conversationBlock = modelBlock(schema, 'Conversation');
    const messageBlock = modelBlock(schema, 'Message');
    const receiptBlock = modelBlock(schema, 'MessageReadReceipt');

    expect(hasIndex(conversationBlock, ['tenantId', 'studentId', 'academicYearId'])).toBe(
      true,
    );
    expect(hasIndex(messageBlock, ['tenantId', 'conversationId', 'createdAt'])).toBe(
      true,
    );
    expect(hasIndex(receiptBlock, ['tenantId', 'userId', 'readAt'])).toBe(true);
  });
});
