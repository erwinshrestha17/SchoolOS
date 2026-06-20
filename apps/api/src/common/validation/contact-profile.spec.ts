import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getNepalMobileCarrier,
  isValidDateOfBirth,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizeNepalPhone,
  normalizePersonName,
  tryNormalizeNepalPhone,
} from '@schoolos/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAdmissionDto } from '../../admissions/dto/create-admission.dto';
import { UpdateSchoolProfileDto } from '../../settings/dto/update-school-profile.dto';
import { CreateStaffDto } from '../../staff/dto/create-staff.dto';
import { UpdateStudentGuardianDto } from '../../students/dto/update-student-guardian.dto';

describe('shared Nepal contact and profile validation', () => {
  it.each([
    ['9841234567', '+9779841234567', 'NTC'],
    ['+9779841234567', '+9779841234567', 'NTC'],
    ['009779841234567', '+9779841234567', 'NTC'],
    ['९८४१२३४५६७', '+9779841234567', 'NTC'],
    ['9801234567', '+9779801234567', 'Ncell'],
  ])('normalizes %s to E.164', (input, expected, carrier) => {
    expect(normalizeNepalPhone(input)).toBe(expected);
    expect(getNepalMobileCarrier(input)).toBe(carrier);
  });

  it.each([
    '9779841234567',
    '09841234567',
    '984123456',
    '98412345678',
    '9721234567',
    '014123456',
  ])('rejects invalid Nepal phone %s', (input) => {
    expect(tryNormalizeNepalPhone(input)).toBeNull();
  });

  it('normalizes and validates Nepali and English names', () => {
    expect(normalizePersonName("  आशा   O'Neil-श्रेष्ठ  ")).toBe(
      "आशा O'Neil-श्रेष्ठ",
    );
    expect(isValidPersonName('राम बहादुर')).toBe(true);
    expect(isValidPersonName('12345')).toBe(false);
    expect(isValidPersonName('🙂')).toBe(false);
    expect(isValidPersonName('   ')).toBe(false);
  });

  it('normalizes + alias emails and rejects invalid or overlong values', () => {
    expect(normalizeEmail(' Staff+HR@School.EDU.NP ')).toBe(
      'staff+hr@school.edu.np',
    );
    expect(isValidEmail('staff+hr@school.edu.np')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(245)}@example.com`)).toBe(false);
  });

  it('accepts date-only DOB and rejects future, impossible, or over-120 dates', () => {
    const today = new Date('2026-06-20T12:00:00.000Z');
    expect(isValidDateOfBirth('2015-02-28', today)).toBe(true);
    expect(isValidDateOfBirth('2027-01-01', today)).toBe(false);
    expect(isValidDateOfBirth('1900-01-01', today)).toBe(false);
    expect(isValidDateOfBirth('2020-02-30', today)).toBe(false);
    expect(isValidDateOfBirth('2020-01-01T00:00:00.000Z', today)).toBe(false);
  });

  it('normalizes student admission and guardian contact DTO values', async () => {
    const admission = plainToInstance(CreateAdmissionDto, {
      firstNameEn: '  Ram  ',
      lastNameEn: ' Bahadur ',
      dateOfBirth: '2015-01-01',
      gender: 'MALE',
      admissionDate: '2026-04-01',
      academicYearId: 'year-1',
      classId: 'class-1',
      confirmNoDisability: true,
      guardians: [
        {
          fullName: '  सीता   श्रेष्ठ ',
          relation: 'mother',
          primaryPhone: '९८४१२३४५६७',
          email: ' Sita+Parent@Example.COM ',
        },
      ],
    });
    expect(await validate(admission)).toEqual([]);
    expect(admission.firstNameEn).toBe('Ram');
    expect(admission.guardians[0].primaryPhone).toBe('+9779841234567');
    expect(admission.guardians[0].email).toBe('sita+parent@example.com');

    const guardian = plainToInstance(UpdateStudentGuardianDto, {
      fullName: '  Hari   Prasad ',
      primaryPhone: '009779801234567',
      email: ' HARI@EXAMPLE.COM ',
    });
    expect(await validate(guardian)).toEqual([]);
    expect(guardian.primaryPhone).toBe('+9779801234567');
  });

  it('validates and normalizes staff creation and school contact settings', async () => {
    const staff = plainToInstance(CreateStaffDto, {
      firstName: '  Maya ',
      lastName: ' Gurung ',
      dateOfBirth: '1990-01-01',
      gender: 'FEMALE',
      address: 'Kathmandu',
      joiningDate: '2026-01-01',
      contractType: 'PERMANENT',
      email: ' Maya+Staff@Example.COM ',
      password: 'password123',
      phone: '९८११२३४५६७',
      roleIds: ['role-1'],
    });
    expect(await validate(staff)).toEqual([]);
    expect(staff.email).toBe('maya+staff@example.com');
    expect(staff.phone).toBe('+9779811234567');

    const settings = plainToInstance(UpdateSchoolProfileDto, {
      principalName: '  सरिता   थापा ',
      schoolPhone: '+9779851234567',
      schoolEmail: ' INFO+OFFICE@SCHOOL.EDU.NP ',
    });
    expect(await validate(settings)).toEqual([]);
    expect(settings.principalName).toBe('सरिता थापा');
    expect(settings.schoolEmail).toBe('info+office@school.edu.np');
  });

  it('keeps shared guardian contact values non-unique and DOB columns date-only', () => {
    const schema = readFileSync(
      join(process.cwd(), 'prisma/schema/student.prisma'),
      'utf8',
    );
    expect(schema).toContain('@@index([tenantId, primaryPhone])');
    expect(schema).not.toContain('@@unique([tenantId, primaryPhone])');
    expect(schema).toContain(
      'dateOfBirth               DateTime                @db.Date',
    );
  });
});
