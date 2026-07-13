import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChartAccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { ImportBankStatementLineDto } from './dto/import-bank-statement.dto';
import {
  bankStatementImportFingerprint,
  validateBankStatementImportLines,
} from './bank-statement-import.util';

export interface AccountingBankImportJob {
  jobRecordId: string;
  accountId: string;
  actor: AuthContext;
}

const BANK_IMPORT_SYNC_ROW_LIMIT = 500;
const BANK_IMPORT_BACKGROUND_ROW_LIMIT = 25000;
const BANK_IMPORT_CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

@Injectable()
export class AccountingBankImportJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    @InjectQueue('accounting-bank-import')
    private readonly bankImportQueue: Queue,
  ) {}

  async queueBankStatementImport(
    accountId: string,
    lines: ImportBankStatementLineDto[],
    actor: AuthContext,
  ) {
    if (!Array.isArray(lines) || lines.length <= BANK_IMPORT_SYNC_ROW_LIMIT) {
      throw new BadRequestException(
        `Bank statement import has ${lines?.length ?? 0} rows and can be imported synchronously via the standard import endpoint.`,
      );
    }
    if (lines.length > BANK_IMPORT_BACKGROUND_ROW_LIMIT) {
      throw new BadRequestException(
        `Bank statement import has ${lines.length} rows, which exceeds the background import limit of ${BANK_IMPORT_BACKGROUND_ROW_LIMIT}. Split the file before importing.`,
      );
    }

    const sanitizedLines = validateBankStatementImportLines(lines);
    const account = await this.prisma.chartAccount.findFirst({
      where: {
        id: accountId,
        tenantId: actor.tenantId,
        type: ChartAccountType.ASSET,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!account) {
      throw new NotFoundException(
        'Active bank or cash account not found in this tenant',
      );
    }

    const fingerprint = bankStatementImportFingerprint(
      accountId,
      sanitizedLines,
    );

    const existingBatch = await this.prisma.bankStatementImportBatch.findFirst({
      where: { tenantId: actor.tenantId, accountId, fingerprint },
      select: { id: true, lineCount: true },
    });
    if (existingBatch) {
      return {
        jobId: null,
        status: 'COMPLETED' as const,
        importBatchId: existingBatch.id,
        totalRows: existingBatch.lineCount,
        processedRows: existingBatch.lineCount,
        reused: true,
      };
    }

    const existingJob = await this.prisma.bankStatementImportJob.findFirst({
      where: { tenantId: actor.tenantId, accountId, fingerprint },
      orderBy: { createdAt: 'desc' },
    });
    if (
      existingJob &&
      existingJob.status !== 'FAILED' &&
      existingJob.status !== 'CANCELLED'
    ) {
      return {
        jobId: existingJob.id,
        status: existingJob.status,
        importBatchId: existingJob.importBatchId,
        totalRows: existingJob.totalRows,
        processedRows: existingJob.processedRows,
        reused: true,
      };
    }

    const asset = await this.fileRegistryService.registerGeneratedFile({
      tenantId: actor.tenantId,
      generatedByUserId: actor.userId,
      originalFilename: `bank-statement-import-${fingerprint.slice(0, 12)}.json`,
      content: Buffer.from(JSON.stringify(lines)),
      mimeType: 'application/json',
      module: 'accounting',
      metadata: { accountId, fingerprint, rowCount: lines.length },
    });

    let job;
    try {
      job = await this.prisma.bankStatementImportJob.create({
        data: {
          tenantId: actor.tenantId,
          accountId,
          fingerprint,
          totalRows: sanitizedLines.length,
          fileAssetId: asset.id,
          requestedBy: actor.userId,
          status: 'QUEUED',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const racedJob = await this.prisma.bankStatementImportJob.findFirst({
          where: { tenantId: actor.tenantId, accountId, fingerprint },
        });
        if (racedJob) {
          return {
            jobId: racedJob.id,
            status: racedJob.status,
            importBatchId: racedJob.importBatchId,
            totalRows: racedJob.totalRows,
            processedRows: racedJob.processedRows,
            reused: true,
          };
        }
      }
      throw error;
    }

    await this.bankImportQueue.add(
      'importBankStatementChunked',
      {
        jobRecordId: job.id,
        accountId,
        actor,
      } satisfies AccountingBankImportJob,
      { jobId: job.id },
    );

    await this.auditService.record({
      action: 'queue_bank_statement_import',
      resource: 'bank_statement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: job.id,
      after: {
        accountId,
        totalRows: sanitizedLines.length,
        fileAssetId: asset.id,
      },
    });

    return {
      jobId: job.id,
      status: 'QUEUED' as const,
      importBatchId: null,
      totalRows: sanitizedLines.length,
      processedRows: 0,
      syncThreshold: BANK_IMPORT_SYNC_ROW_LIMIT,
      backgroundThreshold: BANK_IMPORT_BACKGROUND_ROW_LIMIT,
      reused: false,
    };
  }

  async getBankImportJob(jobId: string, actor: AuthContext) {
    const job = await this.prisma.bankStatementImportJob.findFirst({
      where: { id: jobId, tenantId: actor.tenantId },
    });
    if (!job) {
      throw new NotFoundException('Bank statement import job not found');
    }
    return job;
  }

  async listBankImportJobs(accountId: string, actor: AuthContext) {
    return this.prisma.bankStatementImportJob.findMany({
      where: { tenantId: actor.tenantId, accountId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async completeQueuedBankStatementImport(input: AccountingBankImportJob) {
    const job = await this.prisma.bankStatementImportJob.findFirst({
      where: {
        id: input.jobRecordId,
        tenantId: input.actor.tenantId,
        accountId: input.accountId,
      },
    });
    if (!job) {
      throw new BadRequestException('Bank statement import job not found');
    }
    if (job.status === 'COMPLETED') {
      return;
    }

    const existingBatch = await this.prisma.bankStatementImportBatch.findFirst({
      where: {
        tenantId: input.actor.tenantId,
        accountId: input.accountId,
        fingerprint: job.fingerprint,
      },
    });
    if (existingBatch) {
      await this.prisma.bankStatementImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          importBatchId: existingBatch.id,
          insertedRows: existingBatch.lineCount,
          duplicateRows: 0,
          errorRows: 0,
          processedRows: existingBatch.lineCount,
          completedAt: new Date(),
        },
      });
      return;
    }

    if (!job.fileAssetId) {
      throw new BadRequestException(
        'Bank statement import job is missing its source file',
      );
    }
    const asset = await this.fileRegistryService.getFileMetadata(
      input.actor.tenantId,
      job.fileAssetId,
    );
    const buffer = await this.storageService.getObjectBuffer(asset.objectKey);
    const rawLines = JSON.parse(
      buffer.toString('utf8'),
    ) as ImportBankStatementLineDto[];
    const sanitizedLines = validateBankStatementImportLines(rawLines);
    const fingerprint = bankStatementImportFingerprint(
      input.accountId,
      sanitizedLines,
    );
    if (fingerprint !== job.fingerprint) {
      throw new BadRequestException(
        'Bank statement import source file changed after queueing',
      );
    }

    const importBatchId = `IMPORT-${fingerprint}`;
    const chunks = chunkArray(sanitizedLines, BANK_IMPORT_CHUNK_SIZE);

    try {
      let processed = 0;
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        await this.prisma.$transaction(async (tx) => {
          if (i === 0) {
            await tx.bankStatementImportBatch.create({
              data: {
                id: importBatchId,
                tenantId: input.actor.tenantId,
                accountId: input.accountId,
                fingerprint,
                lineCount: sanitizedLines.length,
                createdById: input.actor.userId,
              },
            });
          }
          await Promise.all(
            chunk.map((line) =>
              tx.bankStatement.create({
                data: {
                  tenantId: input.actor.tenantId,
                  accountId: input.accountId,
                  statementDate: line.statementDate,
                  description: line.description,
                  reference: line.reference,
                  debitAmount: line.debitAmount,
                  creditAmount: line.creditAmount,
                  importBatchId,
                },
              }),
            ),
          );
        });
        processed += chunk.length;
        await this.prisma.bankStatementImportJob.update({
          where: { id: job.id },
          data: { processedRows: processed, status: 'RUNNING' },
        });
      }

      await this.prisma.bankStatementImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          importBatchId,
          insertedRows: sanitizedLines.length,
          duplicateRows: 0,
          errorRows: 0,
          processedRows: sanitizedLines.length,
          completedAt: new Date(),
        },
      });

      await this.auditService.record({
        action: 'import',
        resource: 'bank_statement',
        tenantId: input.actor.tenantId,
        userId: input.actor.userId,
        resourceId: importBatchId,
        after: {
          accountId: input.accountId,
          lineCount: sanitizedLines.length,
          async: true,
          jobId: job.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raceBatch = await this.prisma.bankStatementImportBatch.findFirst({
          where: {
            tenantId: input.actor.tenantId,
            accountId: input.accountId,
            fingerprint,
          },
        });
        if (raceBatch) {
          await this.prisma.bankStatementImportJob.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              importBatchId: raceBatch.id,
              insertedRows: raceBatch.lineCount,
              processedRows: raceBatch.lineCount,
              completedAt: new Date(),
            },
          });
          return;
        }
      }

      // A partial multi-chunk commit can't be left half-applied: without this cleanup a
      // resubmitted import would double-count the rows that already landed before the failure.
      await this.prisma.bankStatement.deleteMany({
        where: {
          tenantId: input.actor.tenantId,
          accountId: input.accountId,
          importBatchId,
        },
      });
      await this.prisma.bankStatementImportBatch.deleteMany({
        where: {
          tenantId: input.actor.tenantId,
          accountId: input.accountId,
          id: importBatchId,
        },
      });
      throw error;
    }
  }
}
