import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  ExternalAuthorityCode,
  ExternalAuthorityHandoffStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { IemisHandoffService } from './iemis-handoff.service';
import { IEMIS_REQUIREMENT_VERSION } from './iemis-rules';

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
    student: { findFirst: jest.fn().mockResolvedValue(null) },
    enrollment: { findFirst: jest.fn().mockResolvedValue(null) },
    guardian: { findFirst: jest.fn().mockResolvedValue(null) },
    studentGuardian: { findFirst: jest.fn().mockResolvedValue(null) },
    tenantSetting: { findFirst: jest.fn().mockResolvedValue(null) },
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

  describe('Phase 5I: stale or outdated snapshots', () => {
    const dataAsOf = '2026-09-30T10:00:00.000Z';
    const cleanExport = (overrides: Record<string, unknown> = {}) => ({
      id: 'export-1',
      fileAssetId: 'asset-1',
      checksum: 'a'.repeat(64),
      filters: {
        artifactPurpose: 'REPORTING_READINESS_HANDOFF',
        schemaAuthority: 'SCHOOL_OS_INTERNAL_RULE_SET',
        artifactStatus: 'REQUIRES_AUTHORIZED_REVIEW',
        directSubmissionSupported: false,
        officialFormatVerified: false,
        configurationIssueCount: 0,
        dataAsOf,
      },
      displayedTotals: { invalidRecords: 0 },
      rowCount: 3,
      definitionVersion: IEMIS_REQUIREMENT_VERSION,
      createdAt: new Date('2026-09-30T10:00:05.000Z'),
      ...overrides,
    });

    it('refuses an export checked under an older rule set', async () => {
      const { service, prisma } = fixture();
      prisma.reportExport.findFirst.mockResolvedValue(
        cleanExport({ definitionVersion: 'SCHOLOS-IEMIS-1.0' }),
      );
      await expect(
        service.create({ reportExportId: 'export-1' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'IEMIS_EXPORT_RULESET_OUTDATED',
        }),
      });
      expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
    });

    it('refuses an export when exported records changed after it was generated', async () => {
      const { service, prisma } = fixture();
      prisma.reportExport.findFirst.mockResolvedValue(cleanExport());
      prisma.guardian.findFirst.mockResolvedValue({ id: 'guardian-1' });
      await expect(
        service.create({ reportExportId: 'export-1' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'IEMIS_EXPORT_STALE',
          changedRecordTypes: ['GUARDIAN'],
        }),
      });
      // Compared with the moment data was read, not the later createdAt.
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: actor.tenantId,
          updatedAt: { gt: new Date(dataAsOf) },
        },
        select: { id: true },
      });
      expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
    });

    it('lets a current export through to the snapshot checks', async () => {
      const { service, prisma } = fixture();
      prisma.reportExport.findFirst.mockResolvedValue(cleanExport());
      await expect(
        service.create({ reportExportId: 'export-1' }, actor),
      ).rejects.toBeInstanceOf(NotFoundException); // asset lookup reached
      expect(prisma.fileAsset.findFirst).toHaveBeenCalled();
    });
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
