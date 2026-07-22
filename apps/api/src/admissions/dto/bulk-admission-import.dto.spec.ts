import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BulkAdmissionImportDto,
  MAX_ADMISSION_IMPORT_CHARACTERS,
} from './bulk-admission-import.dto';

describe('BulkAdmissionImportDto', () => {
  it('accepts a bounded validation request and UUID confirmation receipt', async () => {
    const dto = plainToInstance(BulkAdmissionImportDto, {
      csvContent: 'firstNameEn,lastNameEn\nAsha,Tamang',
      sourceFileName: 'admissions.csv',
      dryRun: false,
      confirmDuplicates: false,
      validationBatchId: '11111111-1111-4111-8111-111111111111',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects oversized content, filenames, and non-UUID receipts', async () => {
    const dto = plainToInstance(BulkAdmissionImportDto, {
      csvContent: 'x'.repeat(MAX_ADMISSION_IMPORT_CHARACTERS + 1),
      sourceFileName: `${'a'.repeat(256)}.csv`,
      validationBatchId: 'not-a-validation-batch',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'csvContent',
        'sourceFileName',
        'validationBatchId',
      ]),
    );
  });
});
