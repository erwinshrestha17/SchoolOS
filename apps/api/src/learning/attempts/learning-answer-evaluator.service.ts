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

    return expectedValues.some(
      (value) => normalizeValue(value) === submittedValue,
    );
  }
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
