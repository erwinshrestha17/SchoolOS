import 'reflect-metadata';
import { validate } from 'class-validator';
import { HomeworkQueryDto } from './homework-query.dto';

describe('HomeworkQueryDto', () => {
  async function assignedDateErrors(assignedDate: string) {
    return validate(Object.assign(new HomeworkQueryDto(), { assignedDate }));
  }

  it('accepts a Nepal-local date-only assignedDate filter', async () => {
    await expect(assignedDateErrors('2026-06-20')).resolves.toHaveLength(0);
  });

  it.each(['2026-6-20', '2026-06-20T00:00:00.000Z', '2026-02-31'])(
    'rejects non-date-only or impossible assignedDate value %s',
    async (assignedDate) => {
      const errors = await assignedDateErrors(assignedDate);

      expect(errors).not.toHaveLength(0);
      expect(errors[0]?.property).toBe('assignedDate');
    },
  );
});
