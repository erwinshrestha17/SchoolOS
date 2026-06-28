import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { MobilePrincipalService } from './mobile-principal.service';

describe('MobilePrincipalService', () => {
  const actor: AuthContext = {
    userId: 'principal-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: ['students:read'],
  };

  it('returns masked guardian contact in principal student lookup', async () => {
    const prisma = {
      student: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'student-1',
            firstNameEn: 'Aarav',
            lastNameEn: 'Sharma',
            class: { name: 'Grade 5' },
            sectionRef: { name: 'A' },
            guardianLinks: [
              {
                guardian: {
                  fullName: 'Mina Sharma',
                  primaryPhone: '+9779800001234',
                },
              },
            ],
            attendanceRecords: [{ status: 'PRESENT' }, { status: 'ABSENT' }],
            invoices: [],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new MobilePrincipalService(prisma as never, {} as never);

    await expect(
      service.searchStudents(actor, { query: 'aarav' }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            name: 'Aarav Sharma',
            guardianName: 'Mina Sharma',
            guardianPhone: '******1234',
            attendanceSummary: '50%',
            feeRisk: 'Clear',
          }),
        ],
      }),
    );
  });
});
