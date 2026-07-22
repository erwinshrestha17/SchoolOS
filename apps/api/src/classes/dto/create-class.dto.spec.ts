import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClassDto } from './create-class.dto';

describe('CreateClassDto Grade 1-12 boundary', () => {
  it.each([1, 10, 11, 12])(
    'accepts supported class level %s',
    async (level) => {
      const dto = plainToInstance(CreateClassDto, {
        name: `Grade ${level}`,
        level,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it.each([0, 13, 11.5])(
    'rejects out-of-scope class level %s',
    async (level) => {
      const dto = plainToInstance(CreateClassDto, {
        name: `Grade ${level}`,
        level,
      });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );

  it('rejects an unbounded class name', async () => {
    const dto = plainToInstance(CreateClassDto, {
      name: 'G'.repeat(101),
      level: 10,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('trims class names and rejects whitespace-only input', async () => {
    const valid = plainToInstance(CreateClassDto, {
      name: '  Grade 11 Science  ',
      level: 11,
    });
    const blank = plainToInstance(CreateClassDto, {
      name: '   ',
      level: 11,
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(valid.name).toBe('Grade 11 Science');
    await expect(validate(blank)).resolves.not.toHaveLength(0);
  });
});
