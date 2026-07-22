import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RevokeStudentQrDto, RotateStudentQrDto } from './student-qr.dto';

describe.each([RotateStudentQrDto, RevokeStudentQrDto])(
  '%s reason validation',
  (Dto) => {
    it('trims and accepts a bounded audit reason', async () => {
      const dto = plainToInstance(Dto, {
        reason: '  Printed card was lost.  ',
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.reason).toBe('Printed card was lost.');
    });

    it.each(['', '   ', 'no', 'x'.repeat(501)])(
      'rejects unsafe reason %p',
      async (reason) => {
        const dto = plainToInstance(Dto, { reason });

        await expect(validate(dto)).resolves.not.toHaveLength(0);
      },
    );
  },
);
