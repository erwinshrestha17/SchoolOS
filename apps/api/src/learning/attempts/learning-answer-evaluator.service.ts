import { Injectable } from '@nestjs/common';
import { LearningQuestionType } from '@prisma/client';

export interface LearningEvaluationQuestion {
  id: string;
  type: LearningQuestionType;
  correctAnswer: unknown;
  points: number;
}

export interface LearningEvaluationResult {
  isCorrect: boolean;
  score: number;
}

@Injectable()
export class LearningAnswerEvaluatorService {
  evaluate(
    question: LearningEvaluationQuestion,
    submittedAnswer: unknown,
  ): LearningEvaluationResult {
    const isCorrect = this.matches(
      question.type,
      question.correctAnswer,
      submittedAnswer,
    );
    return {
      isCorrect,
      score: isCorrect ? question.points : 0,
    };
  }

  private matches(
    type: LearningQuestionType,
    expected: unknown,
    submitted: unknown,
  ) {
    const expectedValues = extractExpectedValues(expected);
    const submittedValue = normalizeValue(submitted);

    if (type === LearningQuestionType.TRUE_FALSE) {
      return expectedValues.some(
        (value) => normalizeBoolean(value) === normalizeBoolean(submitted),
      );
    }

    if (type === LearningQuestionType.MATCHING) {
      return matchesMatching(expected, submitted);
    }

    if (type === LearningQuestionType.ORDERING) {
      return matchesOrdering(expected, submitted);
    }

    return expectedValues.some(
      (value) => normalizeValue(value) === submittedValue,
    );
  }
}

function matchesMatching(expected: unknown, submitted: unknown) {
  const expectedPairs = extractPairs(expected);
  const submittedPairs = extractPairs(submitted);
  if (!expectedPairs.length || expectedPairs.length !== submittedPairs.length) {
    return false;
  }

  const expectedMap = new Map(
    expectedPairs.map((pair) => [
      normalizeValue(pair.leftId),
      normalizeValue(pair.rightId),
    ]),
  );

  return submittedPairs.every(
    (pair) =>
      expectedMap.get(normalizeValue(pair.leftId)) ===
      normalizeValue(pair.rightId),
  );
}

function matchesOrdering(expected: unknown, submitted: unknown) {
  const expectedOrder = extractOrder(expected);
  const submittedOrder = extractOrder(submitted);
  return (
    expectedOrder.length > 0 &&
    expectedOrder.length === submittedOrder.length &&
    expectedOrder.every((id, index) => id === submittedOrder[index])
  );
}

function extractPairs(
  value: unknown,
): Array<{ leftId: unknown; rightId: unknown }> {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => item as Record<string, unknown>)
      .filter((item) => 'leftId' in item && 'rightId' in item)
      .map((item) => ({ leftId: item.leftId, rightId: item.rightId }));
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.pairs)) {
    return extractPairs(record.pairs);
  }
  if (Array.isArray(record.answer)) {
    return extractPairs(record.answer);
  }
  if (Array.isArray(record.value)) {
    return extractPairs(record.value);
  }

  return [];
}

function extractOrder(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeValue).filter(Boolean);
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.order)) {
    return extractOrder(record.order);
  }
  if (Array.isArray(record.answer)) {
    return extractOrder(record.answer);
  }
  if (Array.isArray(record.value)) {
    return extractOrder(record.value);
  }
  if (Array.isArray(record.items)) {
    return record.items
      .map((item) =>
        item && typeof item === 'object'
          ? normalizeValue((item as Record<string, unknown>).id)
          : normalizeValue(item),
      )
      .filter(Boolean);
  }

  return [];
}

function extractExpectedValues(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.answers)) {
      return record.answers;
    }
    if (Array.isArray(record.values)) {
      return record.values;
    }
    if ('value' in record) {
      return [record.value];
    }
    if ('answer' in record) {
      return [record.answer];
    }
  }

  return [value];
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) {
      return normalizeValue(record.value);
    }
    if ('answer' in record) {
      return normalizeValue(record.answer);
    }
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  return '';
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeValue(value);
  if (['true', 'yes', '1'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', '0'].includes(normalized)) {
    return false;
  }
  return normalized;
}
