import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  RemovePlatformJobDto,
  RetryFailedJobDto,
} from './dto/platform-core.dto';

type QueueCounts = Partial<
  Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed', number>
>;

export interface PlatformQueueHealth {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  workerHealth: 'healthy' | 'degraded' | 'unknown';
  error?: string;
}

export interface PlatformFailedJobSummary {
  id: string;
  queueName: string;
  name: string;
  failedReason?: string;
  attemptsMade: number;
  timestamp?: number;
  data: unknown;
  processedOn?: number | null;
  finishedOn?: number | null;
  stacktrace?: string[];
  retryHistory?: Array<{
    id: string;
    userId?: string | null;
    reason?: string | null;
    attemptsMade?: number | null;
    createdAt: string;
  }>;
}

const SECRET_KEY_PATTERN =
  /(api[-_]?key|token|secret|password|credential|authorization|private[-_]?key|cookie|phone|email)/i;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 25;
const MAX_OBJECT_KEYS = 50;

@Injectable()
export class PlatformQueuesService {
  private readonly logger = new Logger(PlatformQueuesService.name);
  private readonly queues: Map<string, Queue>;

  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('finance') private readonly financeQueue: Queue,
    @InjectQueue('payroll') private readonly payrollQueue: Queue,
    @InjectQueue('activity-media') private readonly activityMediaQueue: Queue,
    @InjectQueue('homework') private readonly homeworkQueue: Queue,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
    @InjectQueue('canteen-alerts') private readonly canteenAlertsQueue: Queue,
  ) {
    this.queues = new Map([
      ['notifications', notificationsQueue],
      ['finance', financeQueue],
      ['payroll', payrollQueue],
      ['activity-media', activityMediaQueue],
      ['homework', homeworkQueue],
      ['reports', reportsQueue],
      ['canteen-alerts', canteenAlertsQueue],
    ]);
  }

  async getQueueHealth(): Promise<PlatformQueueHealth[]> {
    const summaries: PlatformQueueHealth[] = [];

    for (const [name, queue] of this.queues.entries()) {
      try {
        const [counts, paused, workers] = await Promise.all([
          queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          ),
          queue.isPaused(),
          this.getWorkersSafely(queue),
        ]);

        summaries.push({
          name,
          waiting: this.count(counts, 'waiting'),
          active: this.count(counts, 'active'),
          completed: this.count(counts, 'completed'),
          failed: this.count(counts, 'failed'),
          delayed: this.count(counts, 'delayed'),
          paused,
          workerHealth:
            workers === null
              ? 'unknown'
              : workers.length > 0
                ? 'healthy'
                : 'degraded',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Queue health unavailable';

        this.logger.warn(
          JSON.stringify({
            queueName: name,
            error: message,
          }),
        );

        summaries.push({
          name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          workerHealth: 'unknown',
          error: message,
        });
      }
    }

    return summaries;
  }

  async listFailedJobs(): Promise<PlatformFailedJobSummary[]> {
    const failedJobs: PlatformFailedJobSummary[] = [];

    for (const [queueName, queue] of this.queues.entries()) {
      const jobs = await queue.getFailed(0, 50);

      for (const job of jobs) {
        failedJobs.push({
          id: String(job.id),
          queueName,
          name: job.name,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          data: sanitizeJobData(job.data),
        });
      }
    }

    return failedJobs.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }

  async getJobDetail(
    queueName: string,
    jobId: string,
  ): Promise<PlatformFailedJobSummary> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new NotFoundException(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    return {
      id: String(job.id),
      queueName,
      name: job.name,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      data: sanitizeJobData(job.data, 0, true),
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      stacktrace: Array.isArray(job.stacktrace) ? job.stacktrace : [],
      retryHistory: await this.listRetryHistory(queueName, jobId),
    };
  }

  async removeJob(
    queueName: string,
    jobId: string,
    dto: RemovePlatformJobDto,
    actorUserId: string,
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new NotFoundException(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    if (typeof job.isFailed === 'function') {
      const isFailed = await job.isFailed();
      if (!isFailed) {
        throw new BadRequestException(
          `Job ${jobId} is no longer in failed state`,
        );
      }
    }

    await job.remove();

    await this.auditService.record({
      action: 'queue_job_removed',
      resource: 'queues',
      resourceId: `${queueName}:${jobId}`,
      tenantId: 'platform',
      userId: actorUserId,
      before: { queueName, jobId, name: job.name },
      after: { removed: true, reason: dto.reason },
    });

    return { success: true };
  }

  async retryFailedJob(dto: RetryFailedJobDto, actorUserId: string) {
    const queue = this.queues.get(dto.queueName);
    if (!queue) {
      throw new NotFoundException(`Queue ${dto.queueName} not found`);
    }

    const job = await queue.getJob(dto.jobId);
    if (!job) {
      throw new NotFoundException(
        `Job ${dto.jobId} not found in queue ${dto.queueName}`,
      );
    }

    const isFailed = await job.isFailed();
    if (!isFailed) {
      throw new BadRequestException(`Job ${dto.jobId} is not in failed state`);
    }

    try {
      await job.retry();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Job ${dto.jobId} could not be retried: ${message}`,
      );
    }

    await this.auditService.record({
      action: 'queue_failed_job_retry_requested',
      resource: 'queues',
      resourceId: `${dto.queueName}:${dto.jobId}`,
      tenantId: 'platform',
      userId: actorUserId,
      before: {
        queueName: dto.queueName,
        jobId: dto.jobId,
        failedReason: job.failedReason ?? null,
        attemptsMade: job.attemptsMade,
      },
      after: {
        retryRequested: true,
        reason: dto.reason ?? null,
      },
    });

    return {
      success: true,
      queueName: dto.queueName,
      jobId: dto.jobId,
    };
  }

  private count(counts: QueueCounts, key: keyof QueueCounts) {
    return Number(counts[key] ?? 0);
  }

  private async getWorkersSafely(queue: Queue) {
    try {
      return await queue.getWorkers();
    } catch {
      return null;
    }
  }

  private async listRetryHistory(queueName: string, jobId: string) {
    const resourceId = `${queueName}:${jobId}`;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId: 'platform',
        resource: 'queues',
        resourceId,
        action: 'queue_failed_job_retry_requested',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userId: true,
        after: true,
        before: true,
        createdAt: true,
      },
    });

    return rows.map((row) => {
      const after = asRecord(row.after);
      const before = asRecord(row.before);
      return {
        id: row.id,
        userId: row.userId,
        reason: typeof after.reason === 'string' ? after.reason : null,
        attemptsMade:
          typeof before.attemptsMade === 'number' ? before.attemptsMade : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeJobData(value: unknown, depth = 0, strict = false): unknown {
  if (depth > 4) {
    return '[Truncated]';
  }

  if (value === null || typeof value === 'undefined') {
    return value;
  }

  if (typeof value === 'string') {
    if (strict && SECRET_KEY_PATTERN.test(value)) {
      return '********';
    }
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeJobData(item, depth + 1, strict));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );

    for (const [key, nestedValue] of entries) {
      if (SECRET_KEY_PATTERN.test(key)) {
        output[key] = '********';
      } else {
        output[key] = sanitizeJobData(nestedValue, depth + 1, strict);
      }
    }

    return output;
  }

  return String(value);
}
