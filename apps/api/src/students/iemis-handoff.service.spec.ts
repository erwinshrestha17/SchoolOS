import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  ExternalAuthorityCode,
  ExternalAuthorityHandoffStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { IemisHandoffService } from './iemis-handoff.service';

const actor: AuthContext = {
  tenantId: 'school-tenant',
  tenantSlug: 'school',
  userId: 'operator',
  email: 'operator@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:manage_lifecycle', 'reports:export'],
};

function fixture() {
  const prisma = {
    externalAuthorityHandoff: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    reportExport: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    fileAsset: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const audit = { record: jest.fn() };
  return {
    prisma,
    service: new IemisHandoffService(prisma as never, audit as never),
  };
}

describe('IemisHandoffService boundary', () => {
  it('returns the same tenant-scoped handoff for a repeated export request', async () => {
    const { service, prisma } = fixture();
    const handoff = {
      id: 'handoff-1',
      tenantId: actor.tenantId,
      reportExportId: 'export-1',
      supersedesId: null,
    };
    prisma.externalAuthorityHandoff.findFirst.mockResolvedValue(handoff);

    await expect(
      service.create({ reportExportId: 'export-1' }, actor),
    ).resolves.toBe(handoff);
    expect(prisma.externalAuthorityHandoff.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        reportExportId: 'export-1',
        authority: ExternalAuthorityCode.CEHRD_IEMIS,
      },
    });
    expect(prisma.reportExport.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an export whose internal readiness checks did not pass', async () => {
    const { service, prisma } = fixture();
    prisma.reportExport.findFirst.mockResolvedValue({
      id: 'export-1',
      fileAssetId: 'asset-1',
      checksum: 'a'.repeat(64),
      filters: {
        artifactPurpose: 'REPORTING_READINESS_HANDOFF',
        schemaAuthority: 'SCHOOL_OS_INTERNAL_RULE_SET',
        artifactStatus: 'BLOCKED_CONFIGURATION',
        directSubmissionSupported: false,
        officialFormatVerified: false,
        configurationIssueCount: 1,
      },
      displayedTotals: { invalidRecords: 0 },
      rowCount: 1,
    });

    await expect(
      service.create({ reportExportId: 'export-1' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
  });

  it('does not record an external state for a cross-tenant handoff id', async () => {
    const { service, prisma } = fixture();

    await expect(
      service.recordEvent(
        'handoff-from-other-school',
        {
          status: ExternalAuthorityHandoffStatus.SUBMITTED,
          evidenceFileId: 'file-1',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.externalAuthorityHandoff.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'handoff-from-other-school',
        tenantId: actor.tenantId,
        authority: ExternalAuthorityCode.CEHRD_IEMIS,
      },
      select: { id: true, status: true, snapshotFileId: true },
    });
  });
});
