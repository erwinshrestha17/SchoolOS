import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateDemoRequestDto } from './create-demo-request.dto';

describe('CreateDemoRequestDto', () => {
  const validPayload = {
    schoolName: 'Everest Academy',
    schoolType: 'Secondary School',
    location: 'Kathmandu',
    studentsCount: '500-1000',
    contactName: 'Principal',
    role: 'Principal',
    phone: '9800000000',
    email: 'principal@school.edu.np',
    expectedTimeline: 'Within 1 month',
  };

  it('accepts a valid public demo request payload', () => {
    const dto = plainToInstance(CreateDemoRequestDto, validPayload);

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects blank required fields submitted directly to the API', () => {
    const dto = plainToInstance(CreateDemoRequestDto, {
      ...validPayload,
      schoolName: '',
      email: '',
    });

    expect(validateSync(dto).map((error) => error.property)).toEqual(
      expect.arrayContaining(['schoolName', 'email']),
    );
  });

  it('limits interested modules to a bounded list', () => {
    const dto = plainToInstance(CreateDemoRequestDto, {
      ...validPayload,
      interestedModules: Array.from({ length: 21 }, (_, index) =>
        'M'.concat(String(index)),
      ),
    });

    expect(validateSync(dto).map((error) => error.property)).toContain(
      'interestedModules',
    );
  });
});
