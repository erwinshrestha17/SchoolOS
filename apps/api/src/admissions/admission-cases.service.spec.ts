import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdmissionCasesService } from './admission-cases.service';

const actor = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  permissions: ['students:manage_lifecycle'],
} as any;

const admissionCase = {
  id: 'case-a',
  tenantId: 'tenant-a',
  status: 'READY_TO_ADMIT',
  firstNameEn: 'Aarav',
  lastNameEn: 'Shrestha',
  firstNameNp: null,
  lastNameNp: null,
  dateOfBirth: new Date('2015-01-01'),
  gender: 'MALE',
  guardianFullName: 'Sita Shrestha',
  guardianRelation: 'Mother',
  guardianPhone: '9800000000',
  guardianEmail: null,
  academicYearId: 'year-a',
  classId: 'class-a',
  sectionId: 'section-a',
  previousSchool: null,
  source: 'OFFICE_WALK_IN',
  notes: null,
  duplicateReview: {},
  convertedStudentId: null,
  rejectedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildPrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    tenantSetting: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    admissionApplication: {
      findFirst: jest.fn().mockResolvedValue(admissionCase),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ ...admissionCase, status: 'ADMITTED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'year-a', name: '2082/83' }) },
    class: { findFirst: jest.fn().mockResolvedValue({ id: 'class-a', name: 'Grade 5', level: 5 }) },
    section: {
      findFirst: jest.fn().mockResolvedValue({ id: 'section-a', name: 'A', classId: 'class-a', capacity: 40 }),
      count: jest.fn().mockResolvedValue(1),
    },
    enrollment: {
      count: jest.fn().mockResolvedValue(10),
      create: jest.fn().mockResolvedValue({ id: 'enrollment-a' }),
    },
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'student-a', studentSystemId: 'STU-001', firstNameEn: 'Aarav', lastNameEn: 'Shrestha' }),
      create: jest.fn().mockResolvedValue({ id: 'student-a' }),
    },
    guardian: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'guardian-a' }),
      update: jest.fn(),
    },
    studentGuardian: { create: jest.fn().mockResolvedValue({ id: 'student-guardian-a' }) },
    studentLifecycleTransition: { create: jest.fn().mockResolvedValue({ id: 'transition-a' }) },
    studentDocument: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    fileAsset: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-a' }) },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    ...overrides,
  };
  return prisma;
}

describe('AdmissionCasesService', () => {
  it('creates the M1 student, guardian, enrollment, lifecycle, and audit atomically without finance writes', async () => {
    const prisma = buildPrisma();
    const service = new AdmissionCasesService(prisma, { record: jest.fn() } as any, { medicalEncryptionKey: undefined } as any);

    const result = await service.directAdmit('case-a', {}, actor);

    expect(result).toEqual(expect.objectContaining({ admissionCaseId: 'case-a', alreadyAdmitted: false }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.student.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.guardian.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.studentGuardian.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.enrollment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.studentLifecycleTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'admission_case_direct_admit', tenantId: 'tenant-a' }) }));
    expect((service as any).financeService).toBeUndefined();
  });

  it('returns the already admitted student on a repeat submission', async () => {
    const prisma = buildPrisma({
      admissionApplication: {
        findFirst: jest.fn().mockResolvedValue({ ...admissionCase, status: 'ADMITTED', convertedStudentId: 'student-a' }),
      },
    });
    const service = new AdmissionCasesService(prisma, { record: jest.fn() } as any, { medicalEncryptionKey: undefined } as any);

    const result = await service.directAdmit('case-a', {}, actor);

    expect(result).toEqual(expect.objectContaining({ alreadyAdmitted: true, student: expect.objectContaining({ id: 'student-a' }) }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('moves review-required policy cases out of direct admission', async () => {
    const prisma = buildPrisma({
      tenantSetting: {
        findFirst: jest.fn().mockResolvedValue({
          value: { defaultPolicy: { admissionMode: 'REVIEW_REQUIRED' }, overrides: [] },
        }),
      },
    });
    const service = new AdmissionCasesService(prisma, { record: jest.fn() } as any, { medicalEncryptionKey: undefined } as any);

    await expect(service.directAdmit('case-a', {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.admissionApplication.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING_FOR_REVIEW' }) }));
  });

  it('fails closed for an admission case outside the authenticated tenant', async () => {
    const prisma = buildPrisma({
      admissionApplication: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = new AdmissionCasesService(prisma, { record: jest.fn() } as any, { medicalEncryptionKey: undefined } as any);

    await expect(service.getCase('case-other-tenant', actor)).rejects.toBeInstanceOf(NotFoundException);
  });
});
