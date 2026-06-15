import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DataExportJobStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import type { AuthContext } from '../auth/auth.types';
import { CreateDataExportJobDto } from './dto/export-center.dto';

export interface DataExporter {
  export(input: {
    tenantId: string;
    exportKey: string;
    format: string;
    filters: Record<string, unknown>;
  }): Promise<{
    content: Buffer;
    fileName: string;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }>;
}

@Injectable()
export class DataExportCenterService {
  private readonly exporters = new Map<string, DataExporter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
    @InjectQueue('advanced-operations') private readonly queue: Queue,
  ) {
    this.registerExporter('advanced.export_jobs', {
      export: async ({ tenantId, format }) => {
        if (format !== 'csv') {
          throw new BadRequestException(
            'advanced.export_jobs supports csv format',
          );
        }
        const jobs = await this.prisma.dataExportJob.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const rows = [
          ['id', 'exportKey', 'format', 'status', 'createdAt', 'completedAt'],
          ...jobs.map((job) => [
            job.id,
            job.exportKey,
            job.format,
            job.status,
            job.createdAt.toISOString(),
            job.completedAt?.toISOString() ?? '',
          ]),
        ];
        return {
          content: Buffer.from(rows.map(csvRow).join('\n')),
          fileName: `export-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: 'text/csv',
          metadata: { rowCount: jobs.length },
        };
      },
    });
  }

  registerExporter(key: string, exporter: DataExporter) {
    this.exporters.set(key, exporter);
  }

  async listJobs(actor: AuthContext) {
    return this.prisma.dataExportJob.findMany({
      where: { tenantId: actor.tenantId },
      include: { failures: true, fileAsset: safeFileAssetSelect() },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createJob(dto: CreateDataExportJobDto, actor: AuthContext) {
    const exportKey = dto.exportKey.trim();
    if (!this.exporters.has(exportKey)) {
      throw new BadRequestException(
        `No backend exporter registered for ${exportKey}`,
      );
    }
    const idempotencyKey =
      dto.idempotencyKey ??
      `${exportKey}:${dto.format}:${JSON.stringify(dto.filters ?? {})}`;
    const existing = await this.prisma.dataExportJob.findFirst({
      where: { tenantId: actor.tenantId, idempotencyKey },
      include: { failures: true, fileAsset: safeFileAssetSelect() },
    });
    if (existing) return existing;

    const job = await this.prisma.dataExportJob.create({
      data: {
        tenantId: actor.tenantId,
        exportKey,
        format: dto.format.trim().toLowerCase(),
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        requestedById: actor.userId,
        idempotencyKey,
        expiresAt: defaultExpiry(),
      },
    });

    await this.queue.add(
      'runDataExport',
      { tenantId: actor.tenantId, jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    await this.auditService.record({
      action: 'data_export_job_created',
      resource: 'data_export_job',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: job.id,
      after: { exportKey: job.exportKey, format: job.format },
    });

    return job;
  }

  async retryJob(jobId: string, actor: AuthContext) {
    const failed = await this.prisma.dataExportJob.findFirst({
      where: { id: jobId, tenantId: actor.tenantId },
    });
    if (!failed) {
      throw new NotFoundException('Export job not found in this tenant');
    }
    if (failed.status !== DataExportJobStatus.FAILED) {
      throw new ConflictException('Only failed export jobs can be retried');
    }

    return this.createRetryJob(failed, actor);
  }

  async completeJob(input: { tenantId: string; jobId: string }) {
    const job = await this.prisma.dataExportJob.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId },
    });
    if (!job) {
      throw new NotFoundException('Export job not found in this tenant');
    }
    if (job.status === DataExportJobStatus.COMPLETED && job.fileAssetId) {
      return job;
    }
    if (!this.exporters.has(job.exportKey)) {
      throw new BadRequestException(
        `No backend exporter registered for ${job.exportKey}`,
      );
    }

    await this.prisma.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: DataExportJobStatus.RUNNING,
        startedAt: job.startedAt ?? new Date(),
      },
    });

    try {
      const exporter = this.exporters.get(job.exportKey);
      if (!exporter) {
        throw new BadRequestException(
          `No backend exporter registered for ${job.exportKey}`,
        );
      }
      const artifact = await exporter.export({
        tenantId: job.tenantId,
        exportKey: job.exportKey,
        format: job.format,
        filters: (job.filters ?? {}) as Record<string, unknown>,
      });
      const file = await this.fileRegistryService.registerGeneratedFile({
        tenantId: job.tenantId,
        generatedByUserId: job.requestedById,
        originalFilename: artifact.fileName,
        content: artifact.content,
        mimeType: artifact.mimeType,
        module: 'data-export-center',
        entityId: job.id,
        metadata: {
          exportKey: job.exportKey,
          format: job.format,
          ...(artifact.metadata ?? {}),
        },
      });
      return this.prisma.dataExportJob.update({
        where: { id: job.id },
        data: {
          status: DataExportJobStatus.COMPLETED,
          fileAssetId: file.id,
          completedAt: new Date(),
          errorSummary: null,
        },
        include: { fileAsset: safeFileAssetSelect(), failures: true },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Data export failed';
      await this.prisma.dataExportJob.update({
        where: { id: job.id },
        data: {
          status: DataExportJobStatus.FAILED,
          errorSummary: message,
          failures: {
            create: {
              tenantId: job.tenantId,
              errorCode: 'EXPORT_FAILED',
              errorMessage: message,
            },
          },
        },
      });
      throw error;
    }
  }

  private async createRetryJob(
    failed: {
      id: string;
      tenantId: string;
      exportKey: string;
      format: string;
      filters: unknown;
    },
    actor: AuthContext,
  ) {
    const retryKey = `${failed.id}:retry:${Date.now()}`;
    const retry = await this.prisma.dataExportJob.create({
      data: {
        tenantId: actor.tenantId,
        exportKey: failed.exportKey,
        format: failed.format,
        filters: failed.filters as Prisma.InputJsonValue,
        requestedById: actor.userId,
        retryOfId: failed.id,
        idempotencyKey: retryKey,
        expiresAt: defaultExpiry(),
      },
    });
    await this.queue.add(
      'runDataExport',
      { tenantId: actor.tenantId, jobId: retry.id },
      { jobId: retry.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
    await this.auditService.record({
      action: 'data_export_job_retried',
      resource: 'data_export_job',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: retry.id,
      before: { failedJobId: failed.id },
      after: { retryJobId: retry.id },
    });
    return retry;
  }
}

function defaultExpiry() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 14);
  return expiresAt;
}

function csvRow(values: Array<string | number>) {
  return values
    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
    .join(',');
}

function safeFileAssetSelect() {
  return {
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      module: true,
      entityId: true,
      status: true,
      createdAt: true,
    },
  };
}
