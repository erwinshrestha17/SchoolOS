import { Gender } from '@prisma/client';
import { type CreateAdmissionDto } from './dto/create-admission.dto';

export interface ParsedAdmissionRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export function normalizeAdmissionName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parseAdmissionCsv(csvContent: string): ParsedAdmissionRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().replace(/^\uFEFF/, ''),
  );

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    return {
      rowNumber: index + 2,
      raw: Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex]?.trim() ?? '',
        ]),
      ),
    };
  });
}

export function buildAdmissionDtoFromCsvRow(
  row: ParsedAdmissionRow,
  confirmDuplicate: boolean,
): { dto?: CreateAdmissionDto; errors: string[] } {
  const raw = row.raw;
  const errors: string[] = [];
  const requiredHeaders = [
    'firstNameEn',
    'lastNameEn',
    'dateOfBirth',
    'gender',
    'admissionDate',
    'academicYearId',
    'classId',
    'guardianFullName',
    'guardianRelation',
    'guardianPhone',
  ];

  for (const header of requiredHeaders) {
    if (!raw[header]) {
      errors.push(`${header} is required`);
    }
  }

  const gender = raw.gender?.toUpperCase();
  if (gender && !Object.values(Gender).includes(gender as Gender)) {
    errors.push('gender must be MALE, FEMALE, or OTHER');
  }

  const rollNumber = raw.rollNumber ? Number(raw.rollNumber) : undefined;
  if (
    raw.rollNumber &&
    (!Number.isInteger(rollNumber) || (rollNumber ?? 0) < 1)
  ) {
    errors.push('rollNumber must be a positive integer');
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    dto: {
      firstNameEn: raw.firstNameEn,
      lastNameEn: raw.lastNameEn,
      firstNameNp: raw.firstNameNp || undefined,
      lastNameNp: raw.lastNameNp || undefined,
      dateOfBirth: raw.dateOfBirth,
      gender: gender as Gender,
      admissionDate: raw.admissionDate,
      admissionNumber: raw.admissionNumber || undefined,
      academicYearId: raw.academicYearId,
      classId: raw.classId,
      sectionId: raw.sectionId || undefined,
      rollNumber,
      nationality: raw.nationality || undefined,
      motherTongue: raw.motherTongue || undefined,
      disabilityFlag: raw.disabilityFlag || undefined,
      confirmNoDisability: parseCsvBoolean(raw.confirmNoDisability),
      mediumOfInstruction: raw.mediumOfInstruction || undefined,
      emergencyName: raw.emergencyName || undefined,
      emergencyPhone: raw.emergencyPhone || undefined,
      medicalConditions: raw.medicalConditions || undefined,
      severeAllergies: raw.severeAllergies || undefined,
      medications: raw.medications || undefined,
      specialNeeds: raw.specialNeeds || undefined,
      doctorName: raw.doctorName || undefined,
      doctorPhone: raw.doctorPhone || undefined,
      confirmDuplicate,
      guardians: [
        {
          fullName: raw.guardianFullName,
          relation: raw.guardianRelation,
          primaryPhone: raw.guardianPhone,
          email: raw.guardianEmail || undefined,
          receivesAlerts: true,
          isPrimary: true,
        },
      ],
    },
    errors: [],
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvBoolean(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
}
