import { LearningQuestionType } from '@prisma/client';
import { LearningAnswerEvaluatorService } from '../src/learning/attempts/learning-answer-evaluator.service';

describe('Learning matching and ordering questions (E2E)', () => {
  it('scores matching answers only when all pairs match exactly', () => {
    const evaluator = new LearningAnswerEvaluatorService();

    const correct = evaluator.evaluate(
      {
        id: 'matching-a',
        type: LearningQuestionType.MATCHING,
        correctAnswer: [
          { leftId: 'left-1', rightId: 'right-1' },
          { leftId: 'left-2', rightId: 'right-2' },
        ],
        points: 2,
      },
      [
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-1', rightId: 'right-1' },
      ],
    );
    const wrong = evaluator.evaluate(
      {
        id: 'matching-a',
        type: LearningQuestionType.MATCHING,
        correctAnswer: [
          { leftId: 'left-1', rightId: 'right-1' },
          { leftId: 'left-2', rightId: 'right-2' },
        ],
        points: 2,
      },
      [
        { leftId: 'left-1', rightId: 'right-2' },
        { leftId: 'left-2', rightId: 'right-1' },
      ],
    );

    expect(correct).toEqual({ isCorrect: true, score: 2 });
    expect(wrong).toEqual({ isCorrect: false, score: 0 });
  });

  it('scores ordering answers only when order matches exactly', () => {
    const evaluator = new LearningAnswerEvaluatorService();

    const correct = evaluator.evaluate(
      {
        id: 'ordering-a',
        type: LearningQuestionType.ORDERING,
        correctAnswer: ['step-1', 'step-2', 'step-3'],
        points: 3,
      },
      ['step-1', 'step-2', 'step-3'],
    );
    const wrong = evaluator.evaluate(
      {
        id: 'ordering-a',
        type: LearningQuestionType.ORDERING,
        correctAnswer: ['step-1', 'step-2', 'step-3'],
        points: 3,
      },
      ['step-2', 'step-1', 'step-3'],
    );

    expect(correct).toEqual({ isCorrect: true, score: 3 });
    expect(wrong).toEqual({ isCorrect: false, score: 0 });
  });
});
