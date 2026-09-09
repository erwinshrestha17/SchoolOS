import { BadRequestException } from '@nestjs/common';
import { validateSchoolSettingValue } from './settings-value-validation';

describe('validateSchoolSettingValue', () => {
  it('accepts the canonical Nepal timezone', () => {
    expect(() => {
      validateSchoolSettingValue('timezone', 'Asia/Kathmandu');
    }).not.toThrow();
  });

  it.each(['UTC', 'Asia/Calcutta', '', null])(
    'rejects a non-canonical timezone value: %p',
    (value) => {
      expect(() => {
        validateSchoolSettingValue('timezone', value);
      }).toThrow(BadRequestException);
    },
  );
});
